import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCustomerCandidates } from '../services/customerMatcher.js'

const customers = [
  { _id: '1', name: 'Ramesh Kumar' },
  { _id: '2', name: 'Ramesh Sharma' },
  { _id: '3', name: 'Suresh Kumar' }
]

test('keeps exact customer matching stable and reports duplicate short names', () => {
  assert.deepEqual(resolveCustomerCandidates('Suresh Kumar', customers), [customers[2]])
  assert.deepEqual(resolveCustomerCandidates('Ramesh', customers), customers.slice(0, 2))
  assert.deepEqual(resolveCustomerCandidates('Unknown', customers), [])
})

