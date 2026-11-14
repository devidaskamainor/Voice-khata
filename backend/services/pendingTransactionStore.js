import { randomUUID } from 'node:crypto'

export const PENDING_EXPIRY_MS = 5 * 60 * 1000

export class PendingTransactionStore {
  #items = new Map()
  #timers = new Map()

  #scheduleExpiry(item) {
    const previous = this.#timers.get(item.id)
    if (previous) clearTimeout(previous)
    const delay = Math.max(1, item.expiresAt - Date.now())
    const timer = setTimeout(() => {
      const current = this.#items.get(item.id)
      if (!current) return
      if (current.expiresAt <= Date.now()) {
        this.#items.delete(item.id)
        this.#timers.delete(item.id)
      } else {
        this.#scheduleExpiry(current)
      }
    }, delay)
    timer.unref?.()
    this.#timers.set(item.id, timer)
  }

  #delete(id) {
    const timer = this.#timers.get(id)
    if (timer) clearTimeout(timer)
    this.#timers.delete(id)
    return this.#items.delete(id)
  }

  create(data, now = Date.now()) {
    const id = randomUUID()
    const state = data.candidates?.length > 1 ? 'AWAITING_CUSTOMER' : 'AWAITING_CONFIRMATION'
    const item = {
      ...data,
      id,
      state,
      revision: 1,
      createdAt: now,
      expiresAt: now + PENDING_EXPIRY_MS
    }
    this.#items.set(id, item)
    this.#scheduleExpiry(item)
    return item
  }

  get(id, now = Date.now()) {
    this.sweep(now)
    return this.#items.get(id) || null
  }

  sweep(now = Date.now()) {
    for (const [id, item] of this.#items) {
      if (item.expiresAt <= now) this.#delete(id)
    }
  }

  selectCustomer(id, customer, now = Date.now()) {
    const item = this.get(id, now)
    if (!item || item.state !== 'AWAITING_CUSTOMER') return null
    item.customerId = customer.id
    item.customerName = customer.name
    item.state = 'AWAITING_CONFIRMATION'
    item.revision += 1
    item.expiresAt = now + PENDING_EXPIRY_MS
    this.#scheduleExpiry(item)
    return item
  }

  correctAmount(id, amount, now = Date.now()) {
    const item = this.get(id, now)
    if (!item || !['AWAITING_CONFIRMATION', 'AWAITING_CORRECTION'].includes(item.state)) return null
    item.amount = amount
    item.state = 'AWAITING_CONFIRMATION'
    item.revision += 1
    item.expiresAt = now + PENDING_EXPIRY_MS
    this.#scheduleExpiry(item)
    return item
  }

  requestCorrection(id, now = Date.now()) {
    const item = this.get(id, now)
    if (!item || !['AWAITING_CONFIRMATION', 'AWAITING_CORRECTION'].includes(item.state)) return null
    item.state = 'AWAITING_CORRECTION'
    item.revision += 1
    item.expiresAt = now + PENDING_EXPIRY_MS
    this.#scheduleExpiry(item)
    return item
  }

  beginSave(id, revision, now = Date.now()) {
    const item = this.get(id, now)
    if (!item || item.state !== 'AWAITING_CONFIRMATION') return null
    if (revision !== undefined && revision !== item.revision) return null
    item.state = 'SAVING'
    return item
  }

  releaseSave(id) {
    const item = this.#items.get(id)
    if (!item || item.state !== 'SAVING') return null
    item.state = 'AWAITING_CONFIRMATION'
    return item
  }

  finish(id) {
    const item = this.#items.get(id) || null
    this.#delete(id)
    return item
  }

  cancel(id, now = Date.now()) {
    const item = this.get(id, now)
    if (!item || item.state === 'SAVING') return null
    item.state = 'CANCELLED'
    this.#delete(id)
    return item
  }
}

export const pendingTransactions = new PendingTransactionStore()
