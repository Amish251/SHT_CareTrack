import { useMemo, useState } from 'react';
import { useEquipmentData } from '../store';
import { allocationsInGroup, applyDelete, buildVisits, describeUnit, fmtDate, typeById, unitById, type Visit } from '../helpers';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import Pagination, { usePagination } from '@/shared/components/Pagination';
import { IconButton, IconLink } from '@/shared/components/RowActions';
import { History, Eye, Pencil, Trash2 } from 'lucide-react';

/** The item whose deposit details print on the receipt: first one with a deposit received, else the first. */
function receiptPrimary(visit: Visit) {
  return visit.items.find((a) => a.depositGiven) ?? visit.primary;
}

export default function HistoryPage() {
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buildVisits(data.allocations)
      .filter((v) => {
        if (typeFilter && !v.items.some((a) => a.typeId === typeFilter)) return false;
        // "Active" = anything in the visit is still out; "Returned" = everything is back.
        if (statusFilter === 'active' && v.active.length === 0) return false;
        if (statusFilter === 'returned' && v.status !== 'returned') return false;
        if (q) {
          const hay = `${v.primary.patientName} ${v.primary.patientPhone}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.primary.issueDate < b.primary.issueDate ? 1 : -1));
  }, [data.allocations, query, typeFilter, statusFilter]);

  const pager = usePagination(rows, 10);

  /** Deletes the whole visit — every item in it. Units held by still-active items are freed. */
  function handleDelete(visit: Visit) {
    const n = visit.items.length;
    const what = n > 1 ? `this visit (${n} items)` : 'this record';
    if (!confirm(`Delete ${what} for ${visit.primary.patientName}? This can't be undone.`)) return;
    const ids = new Set(visit.items.map((a) => a.id));
    const names = visit.items.map((a) => describeUnit(data, a.typeId, a.unitId)).join(', ');

    update((prev) => applyDelete(prev, ids));

    logActivity('Delete loan record', `Deleted ${names} for ${visit.primary.patientName}`);
    showToast(n > 1 ? `${n} items deleted.` : 'Record deleted.');
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function handleViewReceipt(visit: Visit) {
    const allocation = receiptPrimary(visit);
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

  async function handleSendReceipt(visit: Visit) {
    const allocation = receiptPrimary(visit);
    const group = allocationsInGroup(data, allocation);
    const type = typeById(data, allocation.typeId);
    showToast('Preparing receipt…');
    try {
      const { buildDepositReceiptPdf, shareReceiptOnWhatsApp } = await import('@/shared/lib/receipt');
      const blob = await buildDepositReceiptPdf(allocation, group, data);
      const itemDesc = group.length > 1 ? `${group.length} items` : type ? type.name : 'equipment';
      const message = `Security deposit receipt for ${itemDesc} — ${allocation.patientName}. Please find the receipt attached.`;
      const filename = `receipt-${allocation.patientName.replace(/\s+/g, '-')}.pdf`;
      const result = await shareReceiptOnWhatsApp(allocation.patientPhone, blob, filename, message);
      showToast(
        result === 'shared'
          ? 'Share sheet opened — pick WhatsApp, then the chat, to send it.'
          : 'Receipt downloaded and their WhatsApp chat opened — attach the file to send it.'
      );
    } catch (err) {
      console.error('Receipt generation failed:', err);
      showToast('Could not generate the receipt — please try again or report this.');
    }
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <History />
          </div>
          <div>
          <h2>Full History</h2>
          <p className="sub">One row per patient visit — active, partly returned and returned.</p>
        </div>
      </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search patient name or phone…"
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Equipment</th>
              <th>Token</th>
              <th>Deposit</th>
              <th>Issued</th>
              <th>Returned</th>
              <th>Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--slate)', padding: 30 }}>
                  No records match.
                </td>
              </tr>
            ) : (
              pager.pageItems.map((v) => {
                const p = v.primary;
                const multi = v.items.length > 1;
                const allReceived = v.items.every((a) => a.depositGiven);
                // Edit opens on an item still out when there is one, so equipment stays editable.
                const editId = (v.active[0] ?? p).id;
                const statusLabel = v.status === 'active' ? 'Active' : v.status === 'returned' ? 'Returned' : 'Partly returned';
                return (
                  <tr key={v.key}>
                    <td>
                      <strong>{p.patientName}</strong>
                      {multi && (
                        <span className="pill" style={{ marginLeft: 6, background: 'rgba(31, 111, 178, 0.12)', color: 'var(--primary-deep)' }}>
                          {v.items.length} items
                        </span>
                      )}
                      {p.patientPhone && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{p.patientPhone}</div>}
                    </td>
                    <td>
                      {v.items.map((a) => {
                        const t = typeById(data, a.typeId);
                        const found = unitById(data, a.unitId);
                        return (
                          <div key={a.id} style={{ padding: multi ? '2px 0' : 0 }}>
                            {t ? t.name : '—'}{' '}
                            <span style={{ color: 'var(--slate)', fontSize: '11.5px' }}>
                              ({found ? found.unit.label : '—'})
                            </span>
                            {multi && (
                              <span className="mono" style={{ color: 'var(--slate)', fontSize: '11.5px', marginLeft: 6 }}>
                                ₹{a.tokenAmount}
                                {' · '}
                                {a.status === 'returned' ? `returned ${fmtDate(a.returnDate)}` : 'still out'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </td>
                    <td className="mono">
                      ₹{v.totalToken}
                      {multi && <div style={{ fontSize: 10.5, color: 'var(--slate)' }}>total</div>}
                    </td>
                    <td>
                      <span className={`pill ${allReceived ? 'yes' : 'no'}`}>{allReceived ? 'Received' : 'Pending'}</span>
                    </td>
                    <td>{fmtDate(p.issueDate)}</td>
                    <td>{v.status === 'returned' && v.latestReturnDate ? fmtDate(v.latestReturnDate) : '—'}</td>
                    <td>
                      <span className={`pill ${v.status === 'returned' ? 'returned' : 'active'}`}>{statusLabel}</span>
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        {v.items.some((a) => a.depositGiven) && (
                          <>
                            <IconButton icon={<Eye />} label="View receipt" onClick={() => handleViewReceipt(v)} />
                            <WhatsAppShareButton
                              iconOnly
                              phone={p.patientPhone}
                              onShare={() => handleSendReceipt(v)}
                            />
                          </>
                        )}
                        <IconLink icon={<Pencil />} label="Edit record" to={`/equipment-register/edit/${editId}`} />
                        <IconButton
                          icon={<Trash2 />}
                          label={multi ? 'Delete whole visit' : 'Delete record'}
                          variant="danger"
                          onClick={() => handleDelete(v)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          from={pager.from}
          to={pager.to}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      </div>

      {preview && <PdfPreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}
