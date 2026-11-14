import { formatMoney } from '../utils/format.js'

function CustomerList({ customers, onDelete }) {
  if (!customers.length) return <div className="card empty-state">No customers yet. Add your first customer to start a khata.</div>
  return (
    <div className="customer-grid">
      {customers.map((customer) => (
        <article className="card customer-card" key={customer._id}>
          <div className="customer-card-head">
            <span className="transaction-avatar">{customer.name.slice(0, 1).toUpperCase()}</span>
            <div><div className="customer-card-name">{customer.name}</div><div className="customer-card-phone">{customer.phone || 'No phone number'}</div></div>
          </div>
          <div className="customer-balance"><span>Outstanding balance</span><strong>{formatMoney(customer.balance)}</strong></div>
          {onDelete && <div className="customer-card-actions"><button className="button danger" onClick={() => onDelete(customer)} type="button">Remove</button></div>}
        </article>
      ))}
    </div>
  )
}

export default CustomerList
