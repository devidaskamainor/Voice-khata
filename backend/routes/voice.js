import { Router } from 'express'
import mongoose from 'mongoose'
import Customer from '../models/Customer.js'
import Transaction from '../models/Transaction.js'
import {
  getCustomerBalance,
  getDailyTotals,
  getHighestOutstandingCustomer,
  getTotalOutstanding
} from '../services/ledgerService.js'
import {
  parsePendingResponse,
  parseVoiceCommand,
  isNewLedgerCommand,
  parserLimits
} from '../services/aiParser.js'
import { localDateTimeToUtc } from '../services/dateService.js'
import { pendingTransactions } from '../services/pendingTransactionStore.js'
import { resolveCustomerCandidates } from '../services/customerMatcher.js'
import { responseText } from '../services/responseText.js'

const router = Router()
const timeZone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata'

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function responseMetrics(startedAt, parserMs, dbMs, clientTimings = {}) {
  return {
    parserMs,
    databaseMs: dbMs,
    requestMs: Math.round(performance.now() - startedAt),
    recordingToTranscriptMs: Number.isFinite(clientTimings.recordingToTranscriptMs)
      ? Math.max(0, Math.round(clientTimings.recordingToTranscriptMs))
      : null
  }
}

function logMetrics(intent, metrics) {
  console.info('[voice-metrics]', JSON.stringify({ intent, ...metrics }))
}

function pendingPayload(item, message) {
  return {
    intent: item.state === 'AWAITING_CUSTOMER' ? 'AWAITING_CUSTOMER' : 'CONFIRM_TRANSACTION',
    state: item.state,
    pendingId: item.id,
    revision: item.revision,
    customerName: item.customerName || null,
    customerOptions: item.state === 'AWAITING_CUSTOMER'
      ? item.candidates?.map(({ id, name }) => ({ id, name })) || []
      : [],
    type: item.type,
    amount: item.amount,
    transactionDate: item.transactionDate,
    expiresInSeconds: Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000)),
    message
  }
}

async function matchCustomers(name) {
  const customers = await Customer.find({
    name: { $regex: `^${escapeRegex(name)}`, $options: 'i' }
  }).limit(10).select('_id name').lean()
  return resolveCustomerCandidates(name, customers)
}

function matchCandidate(transcript, candidates) {
  const answer = transcript.trim().toLocaleLowerCase()
  const matches = candidates.filter(({ name }) => {
    const normalized = name.toLocaleLowerCase()
    return answer === normalized || normalized.endsWith(` ${answer}`) ||
      answer === normalized.split(' ')[0]
  })
  return matches.length === 1 ? matches[0] : null
}

async function savePending(id, revision, startedAt, clientTimings = {}, language = 'en-IN', parserMs = 0) {
  const pending = pendingTransactions.get(id)
  if (!pending) {
    const prior = await Transaction.findOne({ idempotencyKey: id }).populate('customer', 'name').lean()
    if (prior) {
      const balance = await getCustomerBalance(prior.customer?._id || prior.customer)
      const name = prior.customer?.name || 'Customer'
      return {
        status: 200,
        body: {
          intent: 'COMPLETED',
          message: prior.type === 'CREDIT'
            ? responseText(language, 'savedCredit', { name, amount: prior.amount, balance })
            : responseText(language, 'savedPayment', { name, amount: prior.amount, balance }),
          transaction: prior,
          balance,
          alreadySaved: true
        }
      }
    }
    return { status: 404, body: { message: 'This confirmation expired or was already processed. Please start again.' } }
  }

  const saving = pendingTransactions.beginSave(id, revision)
  if (!saving) {
    return { status: pending.state === 'SAVING' ? 409 : 409, body: { message: 'This confirmation changed or is already being saved. Review the current transaction.' } }
  }

  try {
    const dbStarted = performance.now()
    let transaction
    try {
      transaction = await Transaction.create({
        customer: saving.customerId,
        type: saving.type,
        amount: saving.amount,
        transactionDate: saving.transactionDate,
        source: 'voice',
        idempotencyKey: id
      })
    } catch (error) {
      if (error?.code !== 11000) throw error
      transaction = await Transaction.findOne({ idempotencyKey: id }).lean()
    }
    const balance = await getCustomerBalance(saving.customerId)
    const transactionData = transaction?.toObject ? transaction.toObject() : transaction
    if (transactionData) delete transactionData.idempotencyKey
    const metrics = responseMetrics(startedAt, parserMs, performance.now() - dbStarted, clientTimings)
    logMetrics(saving.type, metrics)
    pendingTransactions.finish(id)
    return {
      status: 201,
      body: {
        intent: 'COMPLETED',
        message: saving.type === 'CREDIT'
          ? responseText(saving.language, 'savedCredit', { name: saving.customerName, amount: saving.amount, balance })
          : responseText(saving.language, 'savedPayment', { name: saving.customerName, amount: saving.amount, balance }),
        customerName: saving.customerName,
        transaction: transactionData,
        balance,
        metrics
      }
    }
  } catch (error) {
    pendingTransactions.releaseSave(id)
    throw error
  }
}

async function handlePendingCommand(req, res, startedAt, clientTimings = {}) {
  const { pendingId, transcript, language = 'en-IN' } = req.body
  const pending = pendingTransactions.get(pendingId)
  if (!pending) {
    const prior = await Transaction.findOne({ idempotencyKey: pendingId }).populate('customer', 'name').lean()
    if (prior) {
      const balance = await getCustomerBalance(prior.customer?._id || prior.customer)
      const name = prior.customer?.name || 'Customer'
      return res.json({
        intent: 'COMPLETED',
        message: prior.type === 'CREDIT'
          ? responseText(language, 'savedCredit', { name, amount: prior.amount, balance })
          : responseText(language, 'savedPayment', { name, amount: prior.amount, balance }),
        transaction: prior,
        balance,
        alreadySaved: true
      })
    }
    return res.status(404).json({ message: 'This pending request expired. Please start the command again.' })
  }

  if (pending.state === 'AWAITING_CUSTOMER') {
    const parserStarted = performance.now()
    const selected = matchCandidate(transcript, pending.candidates || [])
    const metrics = responseMetrics(startedAt, performance.now() - parserStarted, 0, clientTimings)
    if (!selected) {
      logMetrics('CUSTOMER_CLARIFICATION', metrics)
      return res.status(409).json({
        intent: 'AWAITING_CUSTOMER',
        pendingId,
        revision: pending.revision,
        customerOptions: pending.candidates.map(({ id, name }) => ({ id, name })),
        message: 'Please choose one of the named customers.'
      })
    }
    pendingTransactions.selectCustomer(pendingId, selected)
    const updated = pendingTransactions.get(pendingId)
    logMetrics('CUSTOMER_SELECTED', metrics)
    return res.json({ ...pendingPayload(updated, responseText(updated.language, 'selectedCustomer', { name: selected.name, amount: updated.amount, type: updated.type })), metrics })
  }

  if (pending.state === 'SAVING') {
    return res.status(409).json({ message: 'This transaction is already being saved. Please wait.' })
  }

  if (isNewLedgerCommand(transcript)) {
    return res.status(409).json({
      message: responseText(pending.language, 'pendingBlock'),
      pendingId,
      state: pending.state
    })
  }

  const parserStarted = performance.now()
  const action = parsePendingResponse(transcript)
  const parserMs = performance.now() - parserStarted
  const metrics = responseMetrics(startedAt, parserMs, 0, clientTimings)
  logMetrics(`PENDING_${action.action}`, metrics)
  if (action.action === 'CANCEL') {
    pendingTransactions.cancel(pendingId)
    return res.json({ intent: 'CANCELLED', state: 'CANCELLED', cancelled: true, message: responseText(pending.language, 'cancelled'), metrics })
  }
  if (action.action === 'CORRECT_AMOUNT') {
    if (action.amount > parserLimits.maxTransactionAmount) {
      return res.status(400).json({ message: 'The corrected amount is above the supported limit.' })
    }
    const updated = pendingTransactions.correctAmount(pendingId, action.amount)
    return res.json({ ...pendingPayload(updated, responseText(updated.language, updated.type === 'CREDIT' ? 'correctCredit' : 'correctPayment', { amount: action.amount })), metrics })
  }
  if (action.action === 'REQUEST_CORRECTION') {
    const updated = pendingTransactions.requestCorrection(pendingId)
    return res.json({ ...pendingPayload(updated, responseText(updated.language, 'cancelPrompt')), intent: 'AWAITING_CORRECTION', metrics })
  }
  if (action.action === 'INVALID_AMOUNT' || action.action === 'AMBIGUOUS_AMOUNT') {
    return res.status(400).json({ message: action.action === 'INVALID_AMOUNT' ? responseText(pending.language, 'invalidAmount') : responseText(pending.language, 'ambiguousAmount') })
  }
  if (action.action === 'CONFIRM') {
    const result = await savePending(pendingId, pending.revision, startedAt, clientTimings, pending.language, parserMs)
    return res.status(result.status).json(result.body)
  }
  return res.status(400).json({ message: responseText(pending.language, 'pendingPrompt') })
}

router.post('/command', async (req, res) => {
  const startedAt = performance.now()
  let parserMs = 0
  let dbStarted = startedAt
  try {
    pendingTransactions.sweep()
    const { transcript, language = 'en-IN' } = req.body || {}
    const pendingId = req.body?.pendingId
    const clientTimings = req.body?.clientTimings || {}
    if (typeof transcript !== 'string' || !transcript.trim() || transcript.length > 500) {
      return res.status(400).json({ message: 'Please provide a voice transcript of 1 to 500 characters.' })
    }
    if (!['hi-IN', 'en-IN', 'kn-IN'].includes(language)) return res.status(400).json({ message: 'Unsupported response language.' })
    if (pendingId !== undefined) {
      if (typeof pendingId !== 'string' || pendingId.length > 80) return res.status(400).json({ message: 'Invalid pending request ID.' })
      return await handlePendingCommand({ body: { pendingId, transcript, language } }, res, startedAt, clientTimings)
    }

    const parseStarted = performance.now()
    const parsed = parseVoiceCommand(transcript, { timeZone })
    parserMs = performance.now() - parseStarted
    if (parsed.intent === 'UNKNOWN') {
      const key = parsed.clarification === 'amount'
        ? parsed.message?.includes('more than one') ? 'ambiguousAmount'
          : parsed.message?.includes('not valid') ? 'invalidAmount' : 'askAmount'
        : parsed.clarification === 'date' ? 'ambiguousDate'
          : parsed.message?.includes('customer') ? 'askName' : null
      return res.status(400).json({ message: responseText(language, key || 'unknownCommand'), clarification: parsed.clarification })
    }

    dbStarted = performance.now()
    if (parsed.intent === 'GET_DAILY_CREDIT' || parsed.intent === 'GET_DAILY_PAYMENT') {
      const totals = await getDailyTotals({ timeZone })
      const isCredit = parsed.intent === 'GET_DAILY_CREDIT'
      const amount = isCredit ? totals.credit : totals.payment
      const count = isCredit ? totals.creditCount : totals.paymentCount
      const message = responseText(language, isCredit ? 'dailyCredit' : 'dailyPayment', { amount, count })
      const metrics = responseMetrics(startedAt, parserMs, performance.now() - dbStarted, clientTimings)
      logMetrics(parsed.intent, metrics)
      return res.json({ intent: parsed.intent, message, amount, count, date: totals.date, metrics })
    }

    if (parsed.intent === 'GET_TOTAL_BALANCE') {
      const balance = await getTotalOutstanding()
      const metrics = responseMetrics(startedAt, parserMs, performance.now() - dbStarted, clientTimings)
      logMetrics(parsed.intent, metrics)
      return res.json({ intent: parsed.intent, balance, message: responseText(language, 'total', { amount: balance }), metrics })
    }

    if (parsed.intent === 'GET_HIGHEST_BALANCE') {
      const result = await getHighestOutstandingCustomer()
      const metrics = responseMetrics(startedAt, parserMs, performance.now() - dbStarted, clientTimings)
      logMetrics(parsed.intent, metrics)
      const hasOutstanding = result && result.balance > 0
      const message = hasOutstanding
        ? responseText(language, 'highest', { name: result.customer.name, amount: result.balance })
        : responseText(language, 'noBalances')
      return res.json({ intent: parsed.intent, message, customerName: hasOutstanding ? result.customer.name : null, balance: hasOutstanding ? result.balance : 0, metrics })
    }

    if (!parsed.customerName) return res.status(400).json({ message: 'Please say the customer name clearly.' })
    const candidates = await matchCustomers(parsed.customerName)
    if (!candidates.length) {
      return res.status(404).json({ message: responseText(language, 'notFound') })
    }

    if (parsed.intent === 'CHECK_BALANCE') {
      if (candidates.length > 1) {
        return res.status(409).json({
          message: responseText(language, 'chooseCustomer', { name: parsed.customerName }),
          clarification: 'customer'
        })
      }
      const customer = candidates[0]
      const balance = await getCustomerBalance(customer._id)
      const metrics = responseMetrics(startedAt, parserMs, performance.now() - dbStarted, clientTimings)
      logMetrics(parsed.intent, metrics)
      return res.json({ intent: 'CHECK_BALANCE', message: responseText(language, 'balance', { name: customer.name, amount: balance }), customerName: customer.name, balance, metrics })
    }

    if (!['ADD_CREDIT', 'RECORD_PAYMENT'].includes(parsed.intent)) {
      return res.status(400).json({ message: 'This voice command is not supported.' })
    }
    if (!Number.isFinite(parsed.amount) || parsed.amount <= 0 || parsed.amount > parserLimits.maxTransactionAmount) {
      return res.status(400).json({ message: 'Please say a valid amount greater than zero.' })
    }

    const duplicateCandidates = candidates.length > 1
      ? candidates.map(({ _id, name }) => ({ id: _id.toString(), name }))
      : []
    const customer = candidates.length === 1 ? candidates[0] : null
    const type = parsed.intent === 'ADD_CREDIT' ? 'CREDIT' : 'PAYMENT'
    const amount = parsed.amount
    const pending = pendingTransactions.create({
      customerId: customer?._id,
      customerName: customer?.name,
      candidates: duplicateCandidates,
      type,
      amount,
      language,
      transactionDate: localDateTimeToUtc(parsed.transactionDate || new Date().toISOString().slice(0, 10), timeZone, 12)
    })
    const metrics = responseMetrics(startedAt, parserMs, performance.now() - dbStarted, clientTimings)
    logMetrics('PENDING_TRANSACTION', metrics)
    const message = pending.state === 'AWAITING_CUSTOMER'
      ? responseText(language, 'chooseCustomer', { name: parsed.customerName })
      : responseText(language, type === 'CREDIT' ? 'confirmCredit' : 'confirmPayment', { name: customer.name, amount })
    return res.json({ ...pendingPayload(pending, message), metrics })
  } catch (error) {
    console.error('Voice command failed:', error.name || 'Error')
    return res.status(500).json({ message: 'Failed to process the command. Check the database connection and try again.' })
  }
})

router.post('/select-customer', (req, res) => {
  const { pendingId, customerId } = req.body || {}
  if (typeof pendingId !== 'string' || pendingId.length > 80 || !mongoose.isValidObjectId(customerId)) {
    return res.status(400).json({ message: 'A valid pending request and customer selection are required.' })
  }
  const pending = pendingTransactions.get(pendingId)
  if (!pending || pending.state !== 'AWAITING_CUSTOMER') {
    return res.status(404).json({ message: 'Customer selection expired. Please start again.' })
  }
  const candidate = pending.candidates?.find(({ id }) => id === customerId)
  if (!candidate) return res.status(400).json({ message: 'That customer was not one of the matches.' })
  const updated = pendingTransactions.selectCustomer(pendingId, candidate)
  return res.json(pendingPayload(updated, responseText(updated.language, 'selectedCustomer', { name: candidate.name, amount: updated.amount, type: updated.type })))
})

router.post('/confirm', async (req, res) => {
  const startedAt = performance.now()
  try {
    const { pendingId, confirmed, revision, language = 'en-IN' } = req.body || {}
    if (typeof pendingId !== 'string' || pendingId.length > 80) {
      return res.status(400).json({ message: 'Missing transaction confirmation ID.' })
    }
    if (typeof confirmed !== 'boolean') return res.status(400).json({ message: 'Confirmation must be true or false.' })
    if (!Number.isInteger(revision) || revision < 1) return res.status(400).json({ message: 'A current confirmation revision is required.' })
    if (!['hi-IN', 'en-IN', 'kn-IN'].includes(language)) return res.status(400).json({ message: 'Unsupported response language.' })
    const pending = pendingTransactions.get(pendingId)
    if (!pending) {
      const prior = await Transaction.findOne({ idempotencyKey: pendingId }).populate('customer', 'name').lean()
      if (prior) {
        const balance = await getCustomerBalance(prior.customer?._id || prior.customer)
        const name = prior.customer?.name || 'Customer'
        const message = prior.type === 'CREDIT'
          ? responseText(language, 'savedCredit', { name, amount: prior.amount, balance })
          : responseText(language, 'savedPayment', { name, amount: prior.amount, balance })
        return res.json({ intent: 'COMPLETED', message, transaction: prior, balance, alreadySaved: true })
      }
      return res.status(404).json({ message: 'This confirmation expired or was already processed. Please try again.' })
    }
    if (confirmed !== true) {
      const cancelled = pendingTransactions.cancel(pendingId)
      return res.json({ intent: 'CANCELLED', cancelled: true, message: cancelled ? responseText(pending.language, 'cancelled') : 'Transaction is already being saved.' })
    }
    const result = await savePending(pendingId, revision, startedAt, {}, pending.language)
    return res.status(result.status).json(result.body)
  } catch (error) {
    console.error('Transaction confirmation failed:', error.name || 'Error')
    return res.status(500).json({ message: 'Could not save the confirmed transaction. Retry the same confirmation safely.' })
  }
})

router.post('/cancel', (req, res) => {
  const { pendingId } = req.body || {}
  if (typeof pendingId !== 'string' || pendingId.length > 80) {
    return res.status(400).json({ message: 'Missing transaction confirmation ID.' })
  }
  const pending = pendingTransactions.get(pendingId)
  const cancelled = pendingTransactions.cancel(pendingId)
  return res.json({
    cancelled: true,
    message: cancelled ? responseText(pending?.language, 'cancelled') : 'Transaction is no longer pending.'
  })
})

router.get('/summary/today', async (_req, res) => {
  try {
    const totals = await getDailyTotals({ timeZone })
    return res.json(totals)
  } catch (error) {
    console.error('Daily summary failed:', error.name || 'Error')
    return res.status(500).json({ message: 'Could not load today’s ledger totals.' })
  }
})

export default router
