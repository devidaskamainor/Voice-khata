import { formatMoney } from '../utils/format.js'

function TransactionHistory({ transactions, onViewAll }) {
  return (
    <section className="card">
      <div className="card-header">
        <div><h2 className="card-title">Recent activity</h2><p className="card-hint">Your latest ledger entries</p></div>
        <button className="text-button" onClick={onViewAll} type="button">View ledger →</button>
      </div>
      {!transactions.length ? <div className="empty-state">Your recent activity will appear here.</div> : (
        <div className="transaction-list">
          {transactions.slice(0, 5).map((entry) => (
            <div className="transaction-row" key={entry._id}>
              <span className="transaction-avatar">{(entry.customer?.name || '?').slice(0, 1).toUpperCase()}</span>
              <div className="transaction-main">
                <div className="transaction-name">{entry.customer?.name || 'Customer'}</div>
                <div className="transaction-note">{entry.type === 'credit' ? 'Udhar added' : 'Payment received'}{entry.note ? ` · ${entry.note}` : ''}</div>
              </div>
              <div className={`transaction-amount ${entry.type}`}>{entry.type === 'credit' ? '+' : '−'}{formatMoney(entry.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default TransactionHistory
