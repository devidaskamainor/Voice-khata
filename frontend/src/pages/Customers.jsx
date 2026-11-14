import { useState } from 'react'
import CustomerList from '../components/CustomerList.jsx'
import { api } from '../services/api.js'

function Customers({ customers, onRefresh }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addCustomer = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.customers.create({ name: name.trim(), phone: phone.trim() })
      setName('')
      setPhone('')
      setOpen(false)
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const removeCustomer = async (customer) => {
    if (!window.confirm(`Remove ${customer.name} and all their ledger entries?`)) return
    try {
      await api.customers.remove(customer._id)
      await onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-heading"><div><p className="eyebrow">People first</p><h1>Your customers.</h1><p className="page-subtitle">One place for every name and balance.</p></div><button className="button" onClick={() => setOpen(!open)} type="button">＋ Add customer</button></div>
      {open && (
        <form className="card form-card" onSubmit={addCustomer}>
          <h2>New customer</h2>
          <div className="form-grid">
            <div className="field"><label htmlFor="customer-name">Name</label><input autoFocus id="customer-name" maxLength="80" onChange={(event) => setName(event.target.value)} placeholder="e.g. Ravi Patel" required value={name} /></div>
            <div className="field"><label htmlFor="customer-phone">Phone (optional)</label><input id="customer-phone" maxLength="24" onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" value={phone} /></div>
          </div>
          {error && <p className="page-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="button secondary" onClick={() => setOpen(false)} type="button">Cancel</button><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save customer'}</button></div>
        </form>
      )}
      {!open && error && <p className="page-error" role="alert">{error}</p>}
      <CustomerList customers={customers} onDelete={removeCustomer} />
    </div>
  )
}

export default Customers
