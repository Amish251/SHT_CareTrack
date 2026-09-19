import { useMemo, useState } from 'react';
import { useEquipmentData } from '../store';
import { allocationsInGroup, fmtDate, todayStr, typeById, unitById } from '../helpers';
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

  const pager = usePagination(active, 10);

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
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((a) => {
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
                    <td className="col-actions">
                      <div className="row-actions">
                        <IconButton
                          icon={<Undo2 />}
                          label="Mark returned"
                          variant="primary"
                          onClick={() => handleMarkReturned(a.id)}
                        />
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
            label="loans"
          />
        </div>
      )}

      {preview && <PdfPreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}
