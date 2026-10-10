import { useMemo, useState } from 'react';
import { useEquipmentData } from '../store';
import {
  allocationsInGroup,
  applyDelete,
  applyReturn,
  buildVisits,
  describeUnit,
  fmtDate,
  promptReturnDate,
  todayStr,
  typeById,
  unitById,
  type Visit
} from '../helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';
import { logActivity } from '@/shared/lib/activityLog';
import Pagination, { usePagination } from '@/shared/components/Pagination';
import { IconButton, IconLink } from '@/shared/components/RowActions';
import { PackagePlus, Eye, Pencil, Trash2, Undo2 } from 'lucide-react';

/** The item whose deposit details print on the receipt: first one with a deposit received, else the first. */
function receiptPrimary(visit: Visit) {
  return visit.items.find((a) => a.depositGiven) ?? visit.primary;
}

export default function ActiveLoansPage() {
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [depositFilter, setDepositFilter] = useState<'' | 'yes' | 'no'>('');

  const visits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return buildVisits(data.allocations.filter((a) => a.status === 'active'))
      .filter((v) => {
        if (typeFilter && !v.items.some((a) => a.typeId === typeFilter)) return false;
        const allReceived = v.items.every((a) => a.depositGiven);
        if (depositFilter === 'yes' && !allReceived) return false;
        if (depositFilter === 'no' && allReceived) return false;
        if (q) {
          const itemText = v.items.map((a) => describeUnit(data, a.typeId, a.unitId)).join(' ');
          const hay = `${v.primary.patientName} ${v.primary.patientPhone} ${itemText}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.primary.issueDate < b.primary.issueDate ? 1 : -1));
  }, [data, query, typeFilter, depositFilter]);

  const pager = usePagination(visits, 10);

  /** Return every item still out in this visit, or just one of them. */
  function handleMarkReturned(visit: Visit, onlyId?: string) {
    const targets = onlyId ? visit.active.filter((a) => a.id === onlyId) : visit.active;
    if (targets.length === 0) return;
    const returnDate = promptReturnDate();
    if (returnDate === null) return;
    const ids = new Set(targets.map((a) => a.id));

    update((prev) => applyReturn(prev, ids, returnDate));

    const names = targets.map((a) => describeUnit(data, a.typeId, a.unitId)).join(', ');
    showToast(targets.length > 1 ? `${targets.length} items marked as returned.` : `${names} marked as returned.`);
    logActivity('Mark returned', `${names} returned by ${visit.primary.patientName}`);
  }

  /** Deposit status is shared across the whole visit. */
  function handleToggleDeposit(visit: Visit) {
    const ids = new Set(visit.items.map((a) => a.id));
    const allReceived = visit.items.every((a) => a.depositGiven);

    if (allReceived) {
      update((prev) => ({
        ...prev,
        allocations: prev.allocations.map((a) =>
          ids.has(a.id) ? { ...a, depositGiven: false, depositReceivedBy: '' } : a
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
        ids.has(a.id) ? { ...a, depositGiven: true, depositReceivedBy: receivedBy.trim() } : a
      )
    }));
  }

  /** Deletes the items still out in this visit (already-returned items stay in History). */
  function handleDelete(visit: Visit) {
    const n = visit.active.length;
    const what = n > 1 ? `these ${n} items` : 'this record';
    if (!confirm(`Delete ${what} for ${visit.primary.patientName}? This frees up the unit${n > 1 ? 's' : ''} and can't be undone.`))
      return;
    const ids = new Set(visit.active.map((a) => a.id));
    const names = visit.active.map((a) => describeUnit(data, a.typeId, a.unitId)).join(', ');

    update((prev) => applyDelete(prev, ids));

    logActivity('Delete loan record', `Deleted ${names} for ${visit.primary.patientName}`);
    showToast(n > 1 ? `${n} items deleted.` : 'Record deleted.');
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

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
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

  function handleImportIssues(rows: Record<string, string>[]): ImportResult {
    let success = 0;
    let failed = 0;

    update((prev) => {
      let types = prev.types;
      const newAllocations: typeof prev.allocations = [];

      rows.forEach((row) => {
        const patientName = pickField(row, 'PatientName', 'Patient Name', 'Name').trim();
        const phone = pickField(row, 'Phone', 'PatientPhone', 'Contact', 'ContactNumber').trim();
        const typeName = pickField(row, 'EquipmentType', 'Equipment Type', 'Equipment').trim();
        const token = parseFloat(pickField(row, 'TokenAmount', 'Token Amount', 'Deposit'));
        const rowIssueDate = pickField(row, 'IssueDate', 'Issue Date').trim() || todayStr();
        const rowExpectedReturn = pickField(row, 'ExpectedReturn', 'Expected Return').trim();
        const depositGivenRaw = pickField(row, 'DepositGiven', 'Deposit Given', 'Deposit Received').trim().toLowerCase();
        const rowReceivedBy = pickField(row, 'ReceivedBy', 'Received By', 'DepositReceivedBy').trim();
        const rowNotes = pickField(row, 'Notes').trim();

        const type = types.find((t) => t.name.toLowerCase() === typeName.toLowerCase());
        const rowDepositGiven = ['y', 'yes', 'true', '1'].includes(depositGivenRaw);

        if (!patientName || !phone || !type || Number.isNaN(token)) {
          failed++;
          return;
        }
        if (rowDepositGiven && !rowReceivedBy) {
          failed++;
          return;
        }
        const freeUnit = type.units.find((u) => u.status === 'free');
        if (!freeUnit) {
          failed++;
          return;
        }

        types = types.map((t) =>
          t.id !== type.id ? t : { ...t, units: t.units.map((u) => (u.id !== freeUnit.id ? u : { ...u, status: 'engaged' as const })) }
        );

        newAllocations.push({
          id: uid('alloc'),
          groupId: uid('grp'),
          unitId: freeUnit.id,
          typeId: type.id,
          patientName,
          patientPhone: phone,
          tokenAmount: token,
          depositGiven: rowDepositGiven,
          depositReceivedBy: rowDepositGiven ? rowReceivedBy : '',
          issueDate: rowIssueDate,
          expectedReturn: rowExpectedReturn,
          returnDate: '',
          status: 'active',
          notes: rowNotes
        });
        success++;
      });

      return { types, allocations: [...prev.allocations, ...newAllocations] };
    });

    if (success > 0) logActivity('Import issue records', `Imported ${success} issue record(s) from Excel`);
    return { success, failed };
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <PackagePlus />
          </div>
          <div>
            <h2>Issue Equipment</h2>
            <p className="sub">Equipment currently out with patients. Tap the deposit status to update it.</p>
          </div>
        </div>
        <ImportExportBar
          addAction={{ label: '+ Issue equipment', to: '/equipment-register/issue' }}
          entityLabel="issue records"
          sampleFilename="issue-equipment-sample.xlsx"
          sampleHeaders={[
            'PatientName',
            'Phone',
            'EquipmentType',
            'TokenAmount',
            'IssueDate',
            'ExpectedReturn',
            'DepositGiven',
            'ReceivedBy',
            'Notes'
          ]}
          sampleRows={[
            ['Ramesh Patel', '9876543210', 'Wheelchair', 500, '2026-09-01', '2026-10-01', 'Yes', 'Amish Patel', 'Left leg injury'],
            ['Sita Devi', '9123456780', 'Walking Stick', 100, '2026-09-02', '', 'No', '', '']
          ]}
          onImportRows={handleImportIssues}
          exportFilenameBase="active-equipment-issues"
          exportTitle="Active Equipment Issues"
          exportHeaders={['Patient', 'Phone', 'Equipment', 'Unit', 'Token (₹)', 'Deposit', 'Issued', 'Expected Return']}
          getExportRows={() =>
            data.allocations
              .filter((a) => a.status === 'active')
              .map((a) => {
                const t = typeById(data, a.typeId);
                const u = unitById(data, a.unitId);
                return [
                  a.patientName,
                  a.patientPhone,
                  t ? t.name : '—',
                  u ? u.unit.label : '—',
                  a.tokenAmount,
                  a.depositGiven ? 'Received' : 'Pending',
                  fmtDate(a.issueDate),
                  a.expectedReturn ? fmtDate(a.expectedReturn) : '—'
                ];
              })
          }
        />
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

      {visits.length === 0 ? (
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
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((v) => {
                const p = v.primary;
                const multi = v.items.length > 1;
                const allReceived = v.items.every((a) => a.depositGiven);
                const receiptItem = receiptPrimary(v);
                const returnedElsewhere = allocationsInGroup(data, p).length - v.items.length;
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
                          <div
                            key={a.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: multi ? '2px 0' : 0 }}
                          >
                            <span>
                              {t ? t.name : '—'}{' '}
                              <span style={{ color: 'var(--slate)', fontSize: '11.5px' }}>
                                ({found ? found.unit.label : '—'})
                              </span>
                              {multi && (
                                <span className="mono" style={{ color: 'var(--slate)', fontSize: '11.5px', marginLeft: 6 }}>
                                  ₹{a.tokenAmount}
                                </span>
                              )}
                            </span>
                            {multi && (
                              <IconButton
                                icon={<Undo2 />}
                                label={`Mark ${found ? found.unit.label : 'item'} returned`}
                                onClick={() => handleMarkReturned(v, a.id)}
                              />
                            )}
                          </div>
                        );
                      })}
                      {returnedElsewhere > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                          +{returnedElsewhere} already returned
                        </div>
                      )}
                    </td>
                    <td className="mono">
                      ₹{v.totalToken}
                      {multi && <div style={{ fontSize: 10.5, color: 'var(--slate)' }}>total</div>}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`pill ${allReceived ? 'yes' : 'no'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        onClick={() => handleToggleDeposit(v)}
                        title={
                          allReceived
                            ? `Received by ${receiptItem.depositReceivedBy || '—'} — click to undo`
                            : 'Click to mark received'
                        }
                      >
                        {allReceived ? 'Received' : 'Pending'}
                      </button>
                      {allReceived && receiptItem.depositReceivedBy && (
                        <div style={{ fontSize: 10.5, color: 'var(--slate)', marginTop: 3 }}>by {receiptItem.depositReceivedBy}</div>
                      )}
                    </td>
                    <td>{fmtDate(p.issueDate)}</td>
                    <td>{p.expectedReturn ? fmtDate(p.expectedReturn) : '—'}</td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <IconButton
                          icon={<Undo2 />}
                          label={multi ? 'Mark all returned' : 'Mark returned'}
                          variant="primary"
                          onClick={() => handleMarkReturned(v)}
                        />
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
                        <IconLink icon={<Pencil />} label="Edit record" to={`/equipment-register/edit/${p.id}`} />
                        <IconButton
                          icon={<Trash2 />}
                          label={multi ? 'Delete all items' : 'Delete record'}
                          variant="danger"
                          onClick={() => handleDelete(v)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            label="visits"
          />
        </div>
      )}

      {preview && <PdfPreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}
