import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceFromTypeRows, summarizeDailyRows } from '../services/ledgerService.js'

test('customer outstanding balances add credit and subtract payments', () => {
  assert.equal(balanceFromTypeRows([]), 0)
  assert.equal(balanceFromTypeRows([
    { _id: 'CREDIT', amount: 500 },
    { _id: 'PAYMENT', amount: 200 }
  ]), 300)
  assert.equal(balanceFromTypeRows([{ _id: 'PAYMENT', amount: 50 }]), -50)
})

test('daily totals for an empty ledger are zero', () => {
  assert.deepEqual(summarizeDailyRows([], '2026-11-14'), {
    date: '2026-11-14', credit: 0, payment: 0, creditCount: 0, paymentCount: 0
  })
})

test('daily totals keep credit and payment directions separate across multiple rows', () => {
  assert.deepEqual(summarizeDailyRows([
    { _id: 'CREDIT', amount: 750, count: 2 },
    { _id: 'PAYMENT', amount: 250, count: 1 }
  ], '2026-11-14'), {
    date: '2026-11-14', credit: 750, payment: 250, creditCount: 2, paymentCount: 1
  })
})

