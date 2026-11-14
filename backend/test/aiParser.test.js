import test from 'node:test'
import assert from 'node:assert/strict'
import { extractAmount, isNewLedgerCommand, parsePendingResponse, parseVoiceCommand } from '../services/aiParser.js'

test('extracts numeric and English number representations', () => {
  assert.deepEqual(extractAmount('Ramesh ka 340 udhaar'), { status: 'ok', amount: 340 })
  assert.deepEqual(extractAmount('Ramesh ka three hundred forty udhaar'), { status: 'ok', amount: 340 })
  assert.deepEqual(extractAmount('Ramesh ka three-forty udhaar'), { status: 'ok', amount: 340 })
  assert.deepEqual(extractAmount('one thousand two hundred'), { status: 'ok', amount: 1200 })
})

test('extracts Hindi, Devanagari, Kannada transliteration and code-mixed numbers', () => {
  assert.deepEqual(extractAmount('teen sau chaalis'), { status: 'ok', amount: 340 })
  assert.deepEqual(extractAmount('पाँच सौ'), { status: 'ok', amount: 500 })
  assert.deepEqual(extractAmount('mooru nooru'), { status: 'ok', amount: 300 })
  assert.deepEqual(extractAmount('ಮೂರು ನೂರು'), { status: 'ok', amount: 300 })
  assert.deepEqual(extractAmount('ek thousand do sau'), { status: 'ok', amount: 1200 })
})

test('classifies credit and payment direction and parses dates', () => {
  assert.equal(parseVoiceCommand('Ramesh ka teen sau chaalis udhaar').intent, 'ADD_CREDIT')
  assert.equal(parseVoiceCommand('Ramesh ne paanch sau diye').intent, 'RECORD_PAYMENT')
  assert.equal(parseVoiceCommand('Ramesh ge 340 rupaayi saala kodi').intent, 'ADD_CREDIT')
  assert.equal(parseVoiceCommand('Ramesh ge 340 rupaayi saala kodi').customerName, 'Ramesh')
  assert.deepEqual(parseVoiceCommand('रमेश का पाँच सौ उधार'), {
    intent: 'ADD_CREDIT', customerName: 'रमेश', amount: 500,
    transactionDate: parseVoiceCommand('आज रमेश का पाँच सौ उधार').transactionDate,
    dateLabel: 'today'
  })
  assert.deepEqual(parseVoiceCommand('ರಮೇಶ್ ಗೆ ಮೂರು ನೂರು ರೂಪಾಯಿ ಸಾಲ ಕೊಡಿ'), {
    intent: 'ADD_CREDIT', customerName: 'ರಮೇಶ್', amount: 300,
    transactionDate: parseVoiceCommand('ಇಂದು ರಮೇಶ್ ಗೆ ಮೂರು ನೂರು ರೂಪಾಯಿ ಸಾಲ ಕೊಡಿ').transactionDate,
    dateLabel: 'today'
  })
  assert.equal(parseVoiceCommand('Ramesh paid 200 yesterday').intent, 'RECORD_PAYMENT')
})

test('daily and customer ledger questions have explicit intents', () => {
  assert.equal(parseVoiceCommand('Aaj kitna udhaar gaya?').intent, 'GET_DAILY_CREDIT')
  assert.equal(parseVoiceCommand('आज कितना उधार गया?').intent, 'GET_DAILY_CREDIT')
  assert.equal(parseVoiceCommand('How much payment did I receive today?').intent, 'GET_DAILY_PAYMENT')
  assert.equal(parseVoiceCommand('रमेश का बैलेंस कितना है').customerName, 'रमेश')
  assert.deepEqual(parseVoiceCommand("What's Ramesh's outstanding balance?"), {
    intent: 'CHECK_BALANCE', customerName: 'Ramesh'
  })
  assert.equal(parseVoiceCommand('Who has the highest outstanding balance?').intent, 'GET_HIGHEST_BALANCE')
})

test('rejects missing, ambiguous, zero, oversized, and multi-number amounts', () => {
  assert.equal(extractAmount('Ramesh udhaar').status, 'missing')
  assert.equal(extractAmount('Ramesh 200 or 300 udhaar').status, 'ambiguous')
  assert.equal(extractAmount('0').status, 'invalid')
  assert.equal(extractAmount('-5').status, 'invalid')
  assert.equal(extractAmount('minus five').status, 'invalid')
  assert.equal(extractAmount('10000001').status, 'invalid')
  assert.equal(parseVoiceCommand('Ramesh ka udhaar').clarification, 'amount')
  assert.equal(parseVoiceCommand('Ramesh 200 or 300 udhaar').clarification, 'amount')
  assert.equal(parseVoiceCommand('').intent, 'UNKNOWN')
})

test('relative-date ambiguity is surfaced instead of silently choosing', () => {
  assert.equal(parseVoiceCommand('Ramesh ka 500 udhaar kal').clarification, 'date')
  assert.equal(parseVoiceCommand('Ramesh ka 500 udhaar tomorrow').clarification, 'date')
})

test('parses correction, confirmation, and rejection actions safely', () => {
  assert.deepEqual(parsePendingResponse('Nahi, 430'), { action: 'CORRECT_AMOUNT', amount: 430 })
  assert.deepEqual(parsePendingResponse('430'), { action: 'CORRECT_AMOUNT', amount: 430 })
  assert.deepEqual(parsePendingResponse('Yes, 430'), { action: 'CORRECT_AMOUNT', amount: 430 })
  assert.equal(parsePendingResponse('Ramesh 500').action, 'UNKNOWN')
  assert.equal(isNewLedgerCommand('Suresh ka 500 udhaar'), true)
  assert.equal(isNewLedgerCommand('Nahi, 430'), false)
  assert.deepEqual(parsePendingResponse('Amount paanch sau karo'), { action: 'CORRECT_AMOUNT', amount: 500 })
  assert.deepEqual(parsePendingResponse('Change it to 600'), { action: 'CORRECT_AMOUNT', amount: 600 })
  assert.deepEqual(parsePendingResponse('Haan'), { action: 'CONFIRM' })
  assert.deepEqual(parsePendingResponse('No'), { action: 'CANCEL' })
  assert.deepEqual(parsePendingResponse('cancel'), { action: 'CANCEL' })
})

