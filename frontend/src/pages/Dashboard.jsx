import { useState } from 'react'
import CustomerList from '../components/CustomerList.jsx'
import TransactionHistory from '../components/TransactionHistory.jsx'
import VoiceButton from '../components/VoiceButton.jsx'
import { api } from '../services/api.js'
import { formatMoney } from '../utils/format.js'

function Dashboard({ customers, transactions, onSave, onNavigate }) {
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const parseVoice = async (transcript) => {
    try {
      setError('')
      const parsed = await api.voice.parse(transcript)
      const customer = customers.find((item) => item.name.toLowerCase() === parsed.customerName?.toLowerCase())
      setDraft({ transcript, customerId: customer?._id || '', amount: parsed.amount || '', type: parsed.type || 'credit', note: transcript })
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const confirmDraft = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ ...draft, amount: Number(draft.amount), source: 'voice' })
      setDraft(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const balance = customers.reduce((sum, item) => sum + (Number(item.balance) || 0), 0)
  const credits = transactions.filter((item) => item.type === 'credit').reduce((sum, item) => sum + item.amount, 0)
  const payments = transactions.filter((item) => item.type === 'payment').reduce((sum, item) => sum + item.amount, 0)
  const metrics = [
    { label: 'Total outstanding', value: formatMoney(balance), caption: 'Across all customers', icon: '₹' },
    { label: 'Customers', value: customers.length, caption: 'Active in your khata', icon: '♙' },
    { label: 'Udhar recorded', value: formatMoney(credits), caption: 'Total credit entries', icon: '↗' },
    { label: 'Payments received', value: formatMoney(payments), caption: 'Total payments recorded', icon: '↙' },
  ]

  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div><p className="eyebrow">Good business starts with clarity</p><h1>Your khata, at a glance.</h1><p className="page-subtitle">A simple view of what is owed and what has come in.</p></div>
        <button className="button" onClick={() => onNavigate('ledger')} type="button">＋ Add entry</button>
      </div>
      <div className="stats-grid">
        {metrics.map((metric, index) => (
          <article className={`card stat-card ${index === 0 ? 'emphasis' : ''}`} key={metric.label}>
            <span className="stat-label">{metric.label}</span><span className="stat-icon">{metric.icon}</span>
            <div className="stat-value">{metric.value}</div><span className="stat-caption">{metric.caption}</span>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <TransactionHistory transactions={transactions} onViewAll={() => onNavigate('ledger')} />
        <section className="voice-card">
          <div className="voice-card-top"><div><p className="eyebrow">Hands-free entry</p><h2>Say it. Save it.</h2><p>Speak a customer and amount in Hindi or English.</p></div><span className="voice-wave">▂▅▃▇</span></div>
          <div className="voice-control"><VoiceButton onTranscript={parseVoice} /><div><strong>Tap to speak</strong><span>“Ravi ko 500 udhaar”</span></div></div>
          <p className="voice-hint">Review the details before saving.</p>
          {error && <p className="page-error" role="alert">{error}</p>}
          {draft && (
            <form className="draft-box" onSubmit={confirmDraft}>
              <p>Heard: “{draft.transcript}”</p>
              <label htmlFor="voice-customer">Customer</label>
              <select id="voice-customer" required value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}>
                <option value="">Choose customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}
              </select>
              <label htmlFor="voice-amount">Amount (₹)</label>
              <input id="voice-amount" min="0.01" required step="0.01" type="number" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} />
              <label htmlFor="voice-type">Entry type</label>
              <select id="voice-type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="credit">Udhar added</option><option value="payment">Payment received</option></select>
              <div className="draft-actions"><button className="button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Confirm entry'}</button><button className="button secondary" onClick={() => setDraft(null)} type="button">Cancel</button></div>
            </form>
          )}
        </section>
      </div>
      <div className="section-heading"><div><h2 className="card-title">Your customers</h2><p className="card-hint">Keep track of every relationship</p></div><button className="text-button" onClick={() => onNavigate('customers')} type="button">Manage customers →</button></div>
      <CustomerList customers={customers.slice(0, 3)} />
    </div>
  )
}

export default Dashboard
