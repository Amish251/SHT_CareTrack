import { Link } from 'react-router-dom';
import { useFinanceData } from '../store';
import { fmtDate } from '@/features/equipment-register/helpers';

export default function OverviewPage() {
  const [data] = useFinanceData();

  const totalDonations = data.entries.filter((e) => e.kind === 'donation').reduce((s, e) => s + e.amount, 0);
  const totalExpenses = data.entries.filter((e) => e.kind === 'expense').reduce((s, e) => s + e.amount, 0);
  const balance = totalDonations - totalExpenses;

  const recent = data.entries
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Donation Overview</h2>
          <p className="sub">Donations received and expenses paid out by the Trust.</p>
        </div>
        <Link to="/finance/add" className="btn small">
          + Add entry
        </Link>
      </div>

      <div className="grid" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 className="card-eyebrow">Total Donations</h3>
          <div className="num mono" style={{ fontSize: 26, color: 'var(--sage-deep)' }}>
            ₹{totalDonations.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Total Expenses</h3>
          <div className="num mono" style={{ fontSize: 26, color: 'var(--rust)' }}>
            ₹{totalExpenses.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Balance</h3>
          <div className="num mono" style={{ fontSize: 26, color: balance >= 0 ? 'var(--primary-deep)' : 'var(--rust)' }}>
            ₹{balance.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Recent entries</h3>
      {recent.length === 0 ? (
        <div className="empty">
          <div className="display">No entries yet</div>
          <p>Record your first donation or expense to see it here.</p>
        </div>
      ) : (
        <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Party</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    <span className={`pill ${e.kind === 'donation' ? 'yes' : 'no'}`}>
                      {e.kind === 'donation' ? 'Donation' : 'Expense'}
                    </span>
                  </td>
                  <td>{e.category}</td>
                  <td>{e.partyName || '—'}</td>
                  <td className="mono">₹{e.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
