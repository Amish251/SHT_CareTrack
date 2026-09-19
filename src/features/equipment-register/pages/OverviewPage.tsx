import { useMemo } from 'react';
import { useEquipmentData } from '../store';
import { engagedUnits, freeUnits, fmtDate, typeById, unitById } from '../helpers';
import Pagination, { usePagination } from '@/shared/components/Pagination';
import { LayoutDashboard } from 'lucide-react';

export default function OverviewPage() {
  const [data] = useEquipmentData();

  const totalUnits = data.types.reduce((sum, t) => sum + t.units.length, 0);
  const totalEngaged = data.types.reduce((sum, t) => sum + engagedUnits(t).length, 0);
  const totalFree = totalUnits - totalEngaged;

  const tokenTotals = useMemo(() => {
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

  const ledgerRows = useMemo(
    () => data.allocations.slice().sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1)),
    [data.allocations]
  );
  const ledgerPager = usePagination(ledgerRows, 10);

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <LayoutDashboard />
          </div>
          <div>
            <h2>Overview</h2>
            <p className="sub">Stock levels by equipment type, and the full security-deposit ledger.</p>
          </div>
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 className="card-eyebrow">Equipment Types</h3>
          <div className="num mono" style={{ fontSize: 30 }}>
            {data.types.length}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Total Units</h3>
          <div className="num mono" style={{ fontSize: 30 }}>
            {totalUnits}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Currently Free</h3>
          <div className="num mono" style={{ fontSize: 30, color: 'var(--sage-deep)' }}>
            {totalFree}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Currently Engaged</h3>
          <div className="num mono" style={{ fontSize: 30, color: 'var(--marigold-deep)' }}>
            {totalEngaged}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>By Equipment Type</h3>
      {data.types.length === 0 ? (
        <div className="empty" style={{ marginBottom: 28 }}>
          <div className="display">No equipment added yet</div>
          <p>Add your first equipment type from the Equipment Type page.</p>
        </div>
      ) : (
        <div className="panel table-wrap" style={{ padding: '8px 16px', marginBottom: 28 }}>
          <table>
            <thead>
              <tr>
                <th>Equipment type</th>
                <th>Total units</th>
                <th>Free</th>
                <th>Engaged</th>
              </tr>
            </thead>
            <tbody>
              {data.types.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="mono">{t.units.length}</td>
                  <td className="mono" style={{ color: 'var(--sage-deep)' }}>
                    {freeUnits(t).length}
                  </td>
                  <td className="mono" style={{ color: 'var(--marigold-deep)' }}>
                    {engagedUnits(t).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Token Ledger</h3>
      <div className="grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 className="card-eyebrow">Currently Held</h3>
          <div className="num mono" style={{ fontSize: 22, color: 'var(--primary-deep)' }}>
            ₹{tokenTotals.held.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Deposits collected, equipment still on loan</p>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Pending Collection</h3>
          <div className="num mono" style={{ fontSize: 22, color: 'var(--marigold-deep)' }}>
            ₹{tokenTotals.pending.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Equipment issued, deposit not yet taken</p>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Returned</h3>
          <div className="num mono" style={{ fontSize: 22, color: 'var(--sage-deep)' }}>
            ₹{tokenTotals.returned.toLocaleString('en-IN')}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 4 }}>Equipment came back, deposit given back to patient</p>
        </div>
      </div>

      {ledgerRows.length === 0 ? (
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
              {ledgerPager.pageItems.map((a) => {
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
          <Pagination
            page={ledgerPager.page}
            totalPages={ledgerPager.totalPages}
            total={ledgerPager.total}
            from={ledgerPager.from}
            to={ledgerPager.to}
            pageSize={ledgerPager.pageSize}
            onPageChange={ledgerPager.setPage}
            onPageSizeChange={ledgerPager.setPageSize}
            label="ledger entries"
          />
        </div>
      )}
    </div>
  );
}
