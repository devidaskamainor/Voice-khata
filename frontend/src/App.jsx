import { useEffect, useState } from 'react'
import {
  getCustomers,
  addCustomer,
  getTransactions,
  addTransaction,
  getDailySummary
} from './api'
import VoiceAssistant from './VoiceAssistant'
import './App.css'

function App() {
  const [customers, setCustomers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [dailySummary, setDailySummary] = useState({ credit: 0, payment: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: ''
  })

  const [transactionForm, setTransactionForm] = useState({
    customerId: '',
    type: 'CREDIT',
    amount: ''
  })

  async function loadData() {
    try {
      setError('')

      const [customerData, transactionData, summary] = await Promise.all([
        getCustomers(),
        getTransactions(),
        getDailySummary()
      ])

      setCustomers(Array.isArray(customerData) ? customerData : [])
      setTransactions(Array.isArray(transactionData) ? transactionData : [])
      setDailySummary(summary || { credit: 0, payment: 0 })
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Could not load data. Check whether your backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // The async request updates state only after network responses arrive.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadData()
  }, [])

  async function handleAddCustomer(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      await addCustomer({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || null
      })

      setCustomerForm({ name: '', phone: '' })
      setSuccess('Customer added successfully.')

      await loadData()
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Could not add customer.'
      )
    }
  }

  async function handleAddTransaction(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    try {
      await addTransaction({
        customerId: transactionForm.customerId,
        type: transactionForm.type,
        amount: Number(transactionForm.amount)
      })

      setTransactionForm({
        customerId: '',
        type: 'CREDIT',
        amount: ''
      })

      setSuccess('Transaction recorded successfully.')

      await loadData()
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Could not record transaction.'
      )
    }
  }

  const totalOutstanding = customers.reduce(
    (total, customer) =>
      total + Math.max(Number(customer.balance) || 0, 0),
    0
  )

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">₹</div>
          <div>
            <h1>Voice Khata</h1>
            <p>Smart digital ledger for your shop</p>
          </div>
        </div>

        <span className="status">
          <span className="status-dot" />
          Ledger dashboard
        </span>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">YOUR SHOP OVERVIEW</p>
          <h2>Manage your khata.</h2>
          <p className="welcome-text">
            Track customer credit, payments and outstanding balances.
          </p>
        </div>
      </section>

      {error && <div className="notice error">{error}</div>}
      {success && <div className="notice success">{success}</div>}

      {/* Voice Assistant goes here */}
      <VoiceAssistant onTransactionSaved={loadData} />

      {/* Dashboard statistics */}
      <section className="stats">
        <article className="stat-card">
          <p>Total customers</p>
          <h3>{customers.length}</h3>
        </article>

        <article className="stat-card">
          <p>Total outstanding</p>
          <h3>₹{totalOutstanding.toLocaleString('en-IN')}</h3>
        </article>

        <article className="stat-card">
          <p>Recorded transactions</p>
          <h3>{transactions.length}</h3>
        </article>

        <article className="stat-card">
          <p>Credit given today</p>
          <h3>₹{Number(dailySummary.credit || 0).toLocaleString('en-IN')}</h3>
        </article>

        <article className="stat-card">
          <p>Payments received today</p>
          <h3>₹{Number(dailySummary.payment || 0).toLocaleString('en-IN')}</h3>
        </article>
      </section>

      <section className="forms-grid">
        <article className="panel">
          <h3>Add a customer</h3>
          <p className="panel-description">
            Register a customer in your digital ledger.
          </p>

          <form onSubmit={handleAddCustomer}>
            <label htmlFor="customerName">Customer name</label>
            <input
              id="customerName"
              type="text"
              placeholder="Enter customer name"
              value={customerForm.name}
              onChange={(event) =>
                setCustomerForm({
                  ...customerForm,
                  name: event.target.value
                })
              }
              required
            />

            <label htmlFor="customerPhone">Phone number</label>
            <input
              id="customerPhone"
              type="tel"
              placeholder="Enter phone number"
              value={customerForm.phone}
              onChange={(event) =>
                setCustomerForm({
                  ...customerForm,
                  phone: event.target.value
                })
              }
            />

            <button type="submit" className="primary-button">
              Add customer
            </button>
          </form>
        </article>

        <article className="panel">
          <h3>Record a transaction</h3>
          <p className="panel-description">
            Record credit given or a payment received.
          </p>

          <form onSubmit={handleAddTransaction}>
            <label htmlFor="transactionCustomer">Select customer</label>
            <select
              id="transactionCustomer"
              value={transactionForm.customerId}
              onChange={(event) =>
                setTransactionForm({
                  ...transactionForm,
                  customerId: event.target.value
                })
              }
              required
            >
              <option value="">Choose a customer</option>

              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <label htmlFor="transactionType">Transaction type</label>
            <select
              id="transactionType"
              value={transactionForm.type}
              onChange={(event) =>
                setTransactionForm({
                  ...transactionForm,
                  type: event.target.value
                })
              }
            >
              <option value="CREDIT">Credit given</option>
              <option value="PAYMENT">Payment received</option>
            </select>

            <label htmlFor="transactionAmount">Amount in rupees</label>
            <input
              id="transactionAmount"
              type="number"
              min="1"
              step="0.01"
              placeholder="Enter amount"
              value={transactionForm.amount}
              onChange={(event) =>
                setTransactionForm({
                  ...transactionForm,
                  amount: event.target.value
                })
              }
              required
            />

            <button
              type="submit"
              className="primary-button"
              disabled={customers.length === 0}
            >
              Save transaction
            </button>
          </form>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="section-heading">
          <div>
            <h3>Customer ledger</h3>
            <p className="panel-description">
              View your customers and their outstanding balances.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadData}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="empty-state">Loading ledger...</p>
        ) : customers.length === 0 ? (
          <p className="empty-state">
            No customers yet. Add your first customer above.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Outstanding balance</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer._id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone || 'Not provided'}</td>
                    <td className="amount">
                      ₹{(Number(customer.balance) || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer>Voice Khata · AI-assisted digital ledger</footer>
    </main>
  )
}

export default App
