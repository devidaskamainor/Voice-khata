import { Router } from 'express'
import Customer from '../models/Customer.js'
import Transaction from '../models/Transaction.js'
import { getCustomerBalances } from '../services/ledgerService.js'

const router = Router()

// Get all customers with their outstanding balances
router.get('/', async (_req, res) => {
  try {
    const [customers, balances] = await Promise.all([
      Customer.find().sort({ name: 1 }).lean(),
      getCustomerBalances()
    ])

    const result = customers.map((customer) => ({
      ...customer,
      balance: balances.get(customer._id.toString()) || 0
    }))

    res.json(result)
  } catch (error) {
    console.error('Get customers failed:', error.name || 'Error')
    res.status(500).json({ error: 'Failed to fetch customers.' })
  }
})

// Add a customer
router.post('/', async (req, res) => {
  try {
    const name =
      typeof req.body.name === 'string' ? req.body.name.trim() : ''

    const phone =
      typeof req.body.phone === 'string' ? req.body.phone.trim() : ''

    if (!name) {
      return res.status(400).json({
        error: 'Customer name is required.'
      })
    }

    const customer = await Customer.create({
      name,
      phone: phone || null
    })

    res.status(201).json({
      ...customer.toObject(),
      balance: 0
    })
  } catch (error) {
    console.error('Add customer failed:', error.name || 'Error')
    res.status(500).json({ error: 'Failed to add customer.' })
  }
})

// Delete a customer and their transactions
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id)

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found.'
      })
    }

    await Transaction.deleteMany({ customer: customer._id })

    res.json({ deleted: true })
  } catch (error) {
    console.error('Delete customer failed:', error.name || 'Error')
    res.status(500).json({ error: 'Failed to delete customer.' })
  }
})

export default router
