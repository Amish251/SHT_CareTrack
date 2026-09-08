import { useMemo } from 'react';
import { useEquipmentData } from '../store';
import { fmtDate, typeById, unitById } from '../helpers';

export default function TokenOverviewPage() {
  const [data] = useEquipmentData();

  const totals = useMemo(() => {
    let held = 0; // active loan, deposit collected — Trust is currently holding this
    let pending = 0; // active loan, deposit not yet collected
    let returned = 0; // equipment returned, deposit was collected (presumed refunded to patient)
    for (const a of data.allocations) {
      if (a.status === 'active') {
        if (a.depositGiven) held += a.tokenAmount;
        else pending += a.tokenAmount;
      } else if (a.status === 'returned' && a.depositGiven) {
        returned += a.tokenAmount;
      }
    }
    return { held, pending, returned };
  }, [data.allocations]);

  const recent = useMemo(
    () =>
      data.allocations
        .slice()
        .sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))
        .slice(0, 8),
    [data.allocations]
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Token Overview</h2>
          <p className="sub">Security deposits — what's currently held, what's pending, and what's been returned.</p>
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 className="card-eyebrow">Currently Held</h3>
          <div className="num mono" style={{ fontSize: 26, color: 'var(--primary-deep)' }}>
            ₹{totals.held.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Deposits collected, equipment still on loan</p>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Pending Collection</h3>
          <div className="num mono" style={{ fontSize: 26, color: 'var(--marigold-deep)' }}>
            ₹{totals.pending.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Equipment issued, deposit not yet taken</p>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Returned</h3>
          <div className="num mono" style={{ fontSize: 26, color: 'var(--sage-deep)' }}>
            ₹{totals.returned.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Equipment came back, deposit given back to patient</p>
        </div>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Recent activity</h3>
      {recent.length === 0 ? (
        <div className="empty">
          <div className="display">Nothing recorded yet</div>
          <p>Issue your first piece of equipment to see deposit activity here.</p>
        </div>
      ) : (
        <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Equipment</th>
                <th>Token</th>
                <th>Deposit</th>
                <th>Status</th>
                <th>Issued</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => {
                const t = typeById(data, a.typeId);
                const found = unitById(data, a.unitId);
                return (
                  <tr key={a.id}>
                    <td>{a.patientName}</td>
                    <td>
                      {t ? t.name : '—'}{' '}
                      <span style={{ color: 'var(--slate)', fontSize: '11.5px' }}>
                        ({found ? found.unit.label : '—'})
                      </span>
                    </td>
                    <td className="mono">₹{a.tokenAmount}</td>
                    <td>
                      <span className={`pill ${a.depositGiven ? 'yes' : 'no'}`}>
                        {a.depositGiven ? 'Received' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${a.status}`}>{a.status === 'active' ? 'Active' : 'Returned'}</span>
                    </td>
                    <td>{fmtDate(a.issueDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
