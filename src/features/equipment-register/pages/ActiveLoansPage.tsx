import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEquipmentData } from '../store';
import { allocationsInGroup, fmtDate, todayStr, typeById, unitById } from '../helpers';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import { logActivity } from '@/shared/lib/activityLog';

export default function ActiveLoansPage() {
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [depositFilter, setDepositFilter] = useState<'' | 'yes' | 'no'>('');

  const active = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.allocations
      .filter((a) => a.status === 'active')
      .filter((a) => {
        if (typeFilter && a.typeId !== typeFilter) return false;
        if (depositFilter === 'yes' && !a.depositGiven) return false;
        if (depositFilter === 'no' && a.depositGiven) return false;
        if (q) {
          const t = typeById(data, a.typeId);
          const found = unitById(data, a.unitId);
          const hay = `${a.patientName} ${a.patientPhone} ${t ? t.name : ''} ${found ? found.unit.label : ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  }, [data, query, typeFilter, depositFilter]);

  function handleMarkReturned(allocationId: string) {
    const allocation = data.allocations.find((a) => a.id === allocationId);
    if (!allocation) return;
    const found = unitById(data, allocation.unitId);
    const date = window.prompt('Return date (YYYY-MM-DD)?', todayStr());
    if (date === null) return;
    const returnDate = date || todayStr();

    update((prev) => ({
      types: prev.types.map((t) =>
        t.id !== allocation.typeId
          ? t
          : { ...t, units: t.units.map((u) => (u.id !== allocation.unitId ? u : { ...u, status: 'free' })) }
      ),
      allocations: prev.allocations.map((a) =>
        a.id !== allocationId ? a : { ...a, status: 'returned', returnDate }
      )
    }));

    showToast(`${found ? found.unit.label : 'Equipment'} marked as returned.`);
    logActivity('Mark returned', `${found ? found.unit.label : 'Equipment'} returned by ${allocation.patientName}`);
  }

  function handleToggleDeposit(allocationId: string) {
    const allocation = data.allocations.find((a) => a.id === allocationId);
    if (!allocation) return;

    if (allocation.depositGiven) {
      // Turning it back off — no name needed, just clear it.
      update((prev) => ({
        ...prev,
        allocations: prev.allocations.map((a) =>
          a.id !== allocationId ? a : { ...a, depositGiven: false, depositReceivedBy: '' }
        )
      }));
      return;
    }

    const receivedBy = window.prompt('Who received the deposit?', session.username);
    if (receivedBy === null) return; // cancelled
    if (!receivedBy.trim()) {
      showToast('Enter a name to mark the deposit received.');
      return;
    }

    update((prev) => ({
      ...prev,
      allocations: prev.allocations.map((a) =>
        a.id !== allocationId ? a : { ...a, depositGiven: true, depositReceivedBy: receivedBy.trim() }
      )
    }));
  }

  function handleDelete(allocationId: string) {
    const allocation = data.allocations.find((a) => a.id === allocationId);
    if (!allocation) return;
    if (!confirm(`Delete this record for ${allocation.patientName}? This frees up the unit and can't be undone.`))
      return;

    update((prev) => ({
      types: prev.types.map((t) =>
        t.id !== allocation.typeId
          ? t
          : { ...t, units: t.units.map((u) => (u.id !== allocation.unitId ? u : { ...u, status: 'free' })) }
      ),
      allocations: prev.allocations.filter((a) => a.id !== allocationId)
    }));

    logActivity('Delete loan record', `Deleted record for ${allocation.patientName}`);
    showToast('Record deleted.');
  }

  async function handleViewReceipt(allocationId: string) {
    const allocation = data.allocations.find((a) => a.id === allocationId);
    if (!allocation) return;
    const group = allocationsInGroup(data, allocation);
    showToast('Preparing receipt…');
    try {
      const { buildDepositReceiptPdf } = await import('@/shared/lib/receipt');
      const blob = await buildDepositReceiptPdf(allocation, group, data);
      const url = URL.createObjectURL(blob);
      setPreview({ url, title: `Receipt — ${allocation.patientName}` });
    } catch (err) {
      console.error('Receipt generation failed:', err);
      showToast('Could not generate the receipt — please try again or report this.');
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function handleSendReceipt(allocationId: string) {
    const allocation = data.allocations.find((a) => a.id === allocationId);
    if (!allocation) return;
    const group = allocationsInGroup(data, allocation);
    const type = typeById(data, allocation.typeId);
    showToast('Preparing receipt…');
    try {
      const { buildDepositReceiptPdf, shareReceiptOnWhatsApp } = await import('@/shared/lib/receipt');
      const blob = await buildDepositReceiptPdf(allocation, group, data);
      const itemDesc = group.length > 1 ? `${group.length} items` : type ? type.name : 'equipment';
      const message = `Security deposit receipt for ${itemDesc} — ${allocation.patientName}. Please find the receipt attached.`;
      const filename = `receipt-${allocation.patientName.replace(/\s+/g, '-')}.pdf`;
      await shareReceiptOnWhatsApp(allocation.patientPhone, blob, filename, message);
      showToast('Receipt downloaded and their WhatsApp chat opened — attach the file to send it.');
    } catch (err) {
      console.error('Receipt generation failed:', err);
      showToast('Could not generate the receipt — please try again or report this.');
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Active Loans</h2>
          <p className="sub">Equipment currently out with patients. Tap the deposit status to update it.</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search patient, phone, or equipment…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All equipment types</option>
          {data.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={depositFilter} onChange={(e) => setDepositFilter(e.target.value as '' | 'yes' | 'no')}>
          <option value="">All deposit statuses</option>
          <option value="yes">Received</option>
          <option value="no">Pending</option>
        </select>
      </div>

      {active.length === 0 ? (
        <div className="empty">
          <div className="display">{data.allocations.some((a) => a.status === 'active') ? 'No matches' : 'Nothing out right now'}</div>
          <p>
            {data.allocations.some((a) => a.status === 'active')
              ? 'Try a different search or filter.'
              : 'All equipment is back in the store room.'}
          </p>
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
                <th>Issued</th>
                <th>Expected return</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {active.map((a) => {
                const t = typeById(data, a.typeId);
                const found = unitById(data, a.unitId);
                const group = allocationsInGroup(data, a);
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.patientName}</strong>
                      {group.length > 1 && (
                        <span className="pill" style={{ marginLeft: 6, background: 'rgba(31, 111, 178, 0.12)', color: 'var(--primary-deep)' }}>
                          {group.length} items
                        </span>
                      )}
                      {a.patientPhone && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{a.patientPhone}</div>}
                    </td>
                    <td>
                      {t ? t.name : '—'}{' '}
                      <span style={{ color: 'var(--slate)', fontSize: '11.5px' }}>
                        ({found ? found.unit.label : '—'})
                      </span>
                    </td>
                    <td className="mono">₹{a.tokenAmount}</td>
                    <td>
                      <button
                        type="button"
                        className={`pill ${a.depositGiven ? 'yes' : 'no'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => handleToggleDeposit(a.id)}
                        title={a.depositGiven ? `Received by ${a.depositReceivedBy || '—'} — click to undo` : 'Click to mark received'}
                      >
                        {a.depositGiven ? 'Received' : 'Pending'}
                      </button>
                      {a.depositGiven && a.depositReceivedBy && (
                        <div style={{ fontSize: 10.5, color: 'var(--slate)', marginTop: 3 }}>by {a.depositReceivedBy}</div>
                      )}
                    </td>
                    <td>{fmtDate(a.issueDate)}</td>
                    <td>{a.expectedReturn ? fmtDate(a.expectedReturn) : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn small" onClick={() => handleMarkReturned(a.id)}>
                          Mark returned
                        </button>
                        {a.depositGiven && (
                          <>
                            <button type="button" className="btn small secondary" onClick={() => handleViewReceipt(a.id)}>
                              View
                            </button>
                            <WhatsAppShareButton phone={a.patientPhone} onShare={() => handleSendReceipt(a.id)} />
                          </>
                        )}
                        <Link to={`/equipment-register/edit/${a.id}`} className="btn small secondary">
                          Edit
                        </Link>
                        <button type="button" className="btn small danger" onClick={() => handleDelete(a.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview && <PdfPreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}
