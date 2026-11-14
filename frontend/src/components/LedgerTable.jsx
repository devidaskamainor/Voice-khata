import { formatDate, formatMoney } from '../utils/format.js'

function LedgerTable({ transactions, emptyMessage = 'No ledger entries yet.' }) {
  if (!transactions.length) return <div className="empty-state">{emptyMessage}</div>
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Entry</th><th>Note</th><th>Date</th><th>Amount</th></tr></thead>
        <tbody>
          {transactions.map((entry) => (
            <tr key={entry._id}>
              <td>{entry.customer?.name || 'Customer'}</td>
              <td><span className={`type-pill ${entry.type}`}>{entry.type === 'credit' ? 'Udhar' : 'Payment'}</span></td>
              <td>{entry.note || '—'}</td>
              <td>{formatDate(entry.createdAt)}</td>
              <td className={`transaction-amount ${entry.type}`}>{formatMoney(entry.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default LedgerTable
