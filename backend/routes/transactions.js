import { Router } from 'express'
import mongoose from 'mongoose'
import Customer from '../models/Customer.js'
import Transaction from '../models/Transaction.js'
import { getCustomerBalance } from '../services/ledgerService.js'

const router = Router()

// Get transactions
router.get('/', async (req, res) => {
  try {
    const filter = {}

    if (req.query.customerId) {
      if (!mongoose.isValidObjectId(req.query.customerId)) {
        return res.status(400).json({
          error: 'Invalid customer ID.'
        })
      }

      filter.customer = req.query.customerId
    }

    const transactions = await Transaction.find(filter)
      .populate('customer', 'name phone')
      .sort({ transactionDate: -1 })
      .lean()

    res.json(transactions)
  } catch (error) {
    console.error('Get transactions failed:', error.name || 'Error')
    res.status(500).json({
      error: 'Failed to fetch transactions.'
    })
  }
})

// Create a transaction
router.post('/', async (req, res) => {
  try {
    const { customerId, type, amount, transactionDate } = req.body

    if (!customerId || !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({
        error: 'A valid customer ID is required.'
      })
    }

    if (!['CREDIT', 'PAYMENT'].includes(type)) {
      return res.status(400).json({
        error: 'Type must be CREDIT or PAYMENT.'
      })
    }

    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 10_000_000
    ) {
      return res.status(400).json({
        error: 'Amount must be greater than zero and no more than ₹10,000,000.'
      })
    }

    const customer = await Customer.findById(customerId)

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found.'
      })
    }

    let date = new Date()

    if (transactionDate !== undefined) {
      date = new Date(transactionDate)

      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({
          error: 'Invalid transaction date.'
        })
      }
    }

    const transaction = await Transaction.create({
      customer: customer._id,
      type,
      amount,
      transactionDate: date
    })

    const balance = await getCustomerBalance(customer._id)

    res.status(201).json({
      message: 'Transaction recorded successfully.',
      transaction,
      customerName: customer.name,
      balance
    })
  } catch (error) {
    console.error('Record transaction failed:', error.name || 'Error')
    res.status(500).json({
      error: 'Failed to record transaction.'
    })
  }
})

export default router
