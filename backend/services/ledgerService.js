import Customer from "../models/Customer.js";
import Transaction from "../models/Transaction.js";
import { getLocalDayRange } from './dateService.js'

export async function getCustomerBalances() {
  const rows = await Transaction.aggregate([
    {
      $group: {
        _id: { customer: '$customer', type: '$type' },
        amount: { $sum: '$amount' }
      }
    }
  ])
  const grouped = new Map()
  for (const row of rows) {
    const id = row._id.customer.toString()
    const typeRows = grouped.get(id) || []
    typeRows.push({ _id: row._id.type, amount: row.amount })
    grouped.set(id, typeRows)
  }
  return new Map([...grouped].map(([id, typeRows]) => [id, balanceFromTypeRows(typeRows)]))
}

export async function getCustomerBalance(customerId) {
  const customer = await Customer.findById(customerId);

  if (!customer) {
    throw new Error("Customer not found.");
  }

  const rows = await Transaction.aggregate([
    { $match: { customer: customer._id } },
    { $group: { _id: '$type', amount: { $sum: '$amount' } } }
  ])
  return balanceFromTypeRows(rows)
}

export function balanceFromTypeRows(rows) {
  return (rows || []).reduce((balance, row) => {
    if (row._id === 'CREDIT') return balance + Number(row.amount || 0)
    if (row._id === 'PAYMENT') return balance - Number(row.amount || 0)
    return balance
  }, 0)
}

export async function getDailyTotals({ now = new Date(), timeZone = process.env.SHOP_TIMEZONE || 'Asia/Kolkata' } = {}) {
  const range = getLocalDayRange({ now, timeZone })
  const rows = await Transaction.aggregate([
    { $match: { transactionDate: { $gte: range.start, $lt: range.end } } },
    { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } }
  ])
  return summarizeDailyRows(rows, range.date)
}

export function summarizeDailyRows(rows, date = '') {
  const totals = { date, credit: 0, payment: 0, creditCount: 0, paymentCount: 0 }
  for (const row of rows || []) {
    if (row._id === 'CREDIT') {
      totals.credit = row.amount
      totals.creditCount = row.count
    } else if (row._id === 'PAYMENT') {
      totals.payment = row.amount
      totals.paymentCount = row.count
    }
  }
  return totals
}

export async function getTotalOutstanding() {
  const balances = await getCustomerBalances()
  return [...balances.values()].reduce((sum, amount) => sum + Math.max(amount, 0), 0)
}

export async function getHighestOutstandingCustomer() {
  const [customers, balances] = await Promise.all([
    Customer.find().sort({ name: 1 }).lean(),
    getCustomerBalances()
  ])
  const ranked = customers.map((customer) => ({
    customer,
    balance: balances.get(customer._id.toString()) || 0
  })).sort((left, right) => right.balance - left.balance)
  return ranked[0] || null
}
