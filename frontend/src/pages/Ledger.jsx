import { useState } from 'react'
import LedgerTable from '../components/LedgerTable.jsx'

function Ledger({ customers, transactions, onSave }) {
  const [customerId, setCustomerId] = useState('')
  const [type, setType] = useState('credit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const visible = customerId ? transactions.filter((item) => item.customer?._id === customerId) : transactions

  const addEntry = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({ customerId, type, amount: Number(amount), note: note.trim() })
      setAmount('')
      setNote('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-heading"><div><p className="eyebrow">Every rupee, accounted for</p><h1>The ledger.</h1><p className="page-subtitle">Add udhar or record a payment received.</p></div></div>
      <form className="card form-card" onSubmit={addEntry}>
        <h2>Add a ledger entry</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="entry-customer">Customer</label><select id="entry-customer" onChange={(event) => setCustomerId(event.target.value)} required value={customerId}><option value="">Choose customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></div>
          <div className="field"><label htmlFor="entry-type">Entry type</label><select id="entry-type" onChange={(event) => setType(event.target.value)} value={type}><option value="credit">Udhar given</option><option value="payment">Payment received</option></select></div>
          <div className="field"><label htmlFor="entry-amount">Amount (₹)</label><input id="entry-amount" min="0.01" required step="0.01" type="number" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" value={amount} /></div>
          <div className="field"><label htmlFor="entry-note">Note (optional)</label><input id="entry-note" maxLength="240" onChange={(event) => setNote(event.target.value)} placeholder="What was this for?" value={note} /></div>
        </div>
        {error && <p className="page-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button" disabled={saving || customers.length === 0} type="submit">{saving ? 'Saving…' : 'Save entry'}</button></div>
        {!customers.length && <p className="card-hint">Add a customer before creating a ledger entry.</p>}
      </form>
      <section className="card">
        <div className="card-header">
          <div><h2 className="card-title">All entries</h2><p className="card-hint">{visible.length} transaction{visible.length === 1 ? '' : 's'}</p></div>
          <select aria-label="Filter by customer" onChange={(event) => setCustomerId(event.target.value)} value={customerId} style={{ maxWidth: 180, minHeight: 34, border: '1px solid #e1e7df', borderRadius: 7, color: '#59665d', fontSize: 10, padding: '0 9px' }}>
            <option value="">All customers</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
          </select>
        </div>
        <LedgerTable transactions={visible} />
      </section>
    </div>
  )
}

export default Ledger
