import { useMemo, useState } from 'react';
import { useEquipmentData } from '../store';
import { allocationsInGroup, fmtDate, typeById, unitById } from '../helpers';
import { useToast } from '@/shared/components/ui/Toast';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import Pagination, { usePagination } from '@/shared/components/Pagination';
import { IconButton, IconLink } from '@/shared/components/RowActions';
import { History, Eye, Pencil, Trash2 } from 'lucide-react';

export default function HistoryPage() {
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.allocations
      .slice()
      .sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1))
      .filter((a) => {
        if (typeFilter && a.typeId !== typeFilter) return false;
        if (statusFilter && a.status !== statusFilter) return false;
        if (q) {
          const hay = `${a.patientName} ${a.patientPhone}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [data.allocations, query, typeFilter, statusFilter]);

  const pager = usePagination(rows, 10);

  function handleDelete(allocationId: string) {
    const allocation = data.allocations.find((a) => a.id === allocationId);
    if (!allocation) return;
    if (!confirm(`Delete this record for ${allocation.patientName}? This can't be undone.`)) return;

    update((prev) => ({
      types: prev.types.map((t) =>
        t.id !== allocation.typeId
          ? t
          : {
              ...t,
              units: t.units.map((u) =>
                u.id !== allocation.unitId ? u : { ...u, status: allocation.status === 'active' ? 'free' : u.status }
              )
            }
      ),
      allocations: prev.allocations.filter((a) => a.id !== allocationId)
    }));

    showToast('Record deleted.');
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
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
          <p className="sub">Every allocation ever recorded — active and returned.</p>
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
              pager.pageItems.map((a) => {
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
                      <span className={`pill ${a.depositGiven ? 'yes' : 'no'}`}>
                        {a.depositGiven ? 'Received' : 'Pending'}
                      </span>
                    </td>
                    <td>{fmtDate(a.issueDate)}</td>
                    <td>{a.returnDate ? fmtDate(a.returnDate) : '—'}</td>
                    <td>
                      <span className={`pill ${a.status}`}>{a.status === 'active' ? 'Active' : 'Returned'}</span>
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        {a.depositGiven && (
                          <>
                            <IconButton icon={<Eye />} label="View receipt" onClick={() => handleViewReceipt(a.id)} />
                            <WhatsAppShareButton
                              iconOnly
                              phone={a.patientPhone}
                              onShare={() => handleSendReceipt(a.id)}
                            />
                          </>
                        )}
                        <IconLink icon={<Pencil />} label="Edit record" to={`/equipment-register/edit/${a.id}`} />
                        <IconButton
                          icon={<Trash2 />}
                          label="Delete record"
                          variant="danger"
                          onClick={() => handleDelete(a.id)}
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
