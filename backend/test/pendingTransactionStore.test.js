import test from 'node:test'
import assert from 'node:assert/strict'
import { PendingTransactionStore, PENDING_EXPIRY_MS } from '../services/pendingTransactionStore.js'

const base = {
  customerId: 'customer-a', customerName: 'Ramesh Kumar',
  type: 'CREDIT', amount: 340, transactionDate: new Date('2026-11-13T06:30:00Z')
}

test('amount correction updates the same pending entry and requires a new confirmation revision', () => {
  const store = new PendingTransactionStore()
  const pending = store.create(base, 1000)
  const originalRevision = pending.revision
  const corrected = store.correctAmount(pending.id, 430, 2000)
  assert.equal(corrected.id, pending.id)
  assert.equal(corrected.amount, 430)
  assert.equal(corrected.state, 'AWAITING_CONFIRMATION')
  assert.equal(corrected.revision, originalRevision + 1)
  assert.equal(store.beginSave(pending.id, originalRevision, 3000), null)
  assert.equal(store.beginSave(pending.id, corrected.revision, 3000).amount, 430)
})

test('cancellation after a correction removes the pending entry without saving', () => {
  const store = new PendingTransactionStore()
  const pending = store.create(base, 1000)
  store.correctAmount(pending.id, 500, 2000)
  assert.equal(store.cancel(pending.id, 3000).state, 'CANCELLED')
  assert.equal(store.get(pending.id, 3001), null)
})

test('duplicate confirmation cannot enter SAVING twice and an expired request is removed', () => {
  const store = new PendingTransactionStore()
  const pending = store.create(base, 1000)
  assert.equal(store.beginSave(pending.id, pending.revision, 2000).state, 'SAVING')
  assert.equal(store.beginSave(pending.id, pending.revision, 2001), null)

  const expiring = store.create(base, 5000)
  assert.equal(store.get(expiring.id, 5000 + PENDING_EXPIRY_MS), null)
})

test('duplicate customer candidates remain unresolved until an explicit selection', () => {
  const store = new PendingTransactionStore()
  const pending = store.create({
    ...base,
    customerId: undefined,
    customerName: undefined,
    candidates: [
      { id: 'customer-a', name: 'Ramesh Kumar' },
      { id: 'customer-b', name: 'Ramesh Sharma' }
    ]
  }, 1000)
  assert.equal(pending.state, 'AWAITING_CUSTOMER')
  assert.equal(pending.customerId, undefined)
  assert.equal(store.selectCustomer(pending.id, { id: 'customer-b', name: 'Ramesh Sharma' }, 2000).customerId, 'customer-b')
})

