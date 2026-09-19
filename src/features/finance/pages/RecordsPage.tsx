import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceData } from '../store';
import { PAYMENT_MODES, type FinanceEntry, type FinanceKind, type PaymentMode } from '../types';
import { categoryDisplay, donationReceiptNumber, expenseReceiptNumber } from '../helpers';
import { fmtDate, todayStr } from '@/features/equipment-register/helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';
import Pagination, { usePagination } from '@/shared/components/Pagination';
import { IconButton, IconLink } from '@/shared/components/RowActions';
import { logActivity } from '@/shared/lib/activityLog';
import { Receipt, Eye, Pencil, Trash2 } from 'lucide-react';

export default function RecordsPage() {
  const [data, update] = useFinanceData();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | FinanceKind>('');
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.entries
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((e) => {
        if (kindFilter && e.kind !== kindFilter) return false;
        if (q) {
          const hay = `${e.partyName} ${categoryDisplay(e)} ${e.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [data.entries, query, kindFilter]);

  const pager = usePagination(rows, 10);

  function handleDelete(id: string) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const entry = data.entries.find((e) => e.id === id);
    update((prev) => ({ entries: prev.entries.filter((e) => e.id !== id) }));
    if (entry) {
      logActivity(
        entry.kind === 'donation' ? 'Delete donation' : 'Delete expense',
        `Deleted ${entry.kind} of ₹${entry.amount}${entry.partyName ? ` — ${entry.partyName}` : ''}`
      );
    }
    showToast('Entry deleted.');
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function handleViewReceipt(id: string) {
    const entry = data.entries.find((e) => e.id === id);
    if (!entry) return;
    showToast('Preparing receipt…');
    try {
      const { buildDonationReceiptPdf } = await import('@/shared/lib/receipt');
      const blob = await buildDonationReceiptPdf(entry, data);
      const url = URL.createObjectURL(blob);
      setPreview({ url, title: `Receipt — ${entry.partyName || 'Donation'}` });
    } catch (err) {
      console.error('Receipt generation failed:', err);
      showToast('Could not generate the receipt — please try again or report this.');
    }
  }

  async function handleSendReceipt(id: string) {
    const entry = data.entries.find((e) => e.id === id);
    if (!entry) return;
    showToast('Preparing receipt…');
    try {
      const { buildDonationReceiptPdf, shareReceiptOnWhatsApp } = await import('@/shared/lib/receipt');
      const blob = await buildDonationReceiptPdf(entry, data);
      const receiptNo = donationReceiptNumber(data, entry);
      const message = `Donation receipt ${receiptNo} for ₹${entry.amount} — thank you${entry.partyName ? ', ' + entry.partyName : ''}! Please find the receipt attached.`;
      const filename = `donation-receipt-${(entry.partyName || 'donor').replace(/\s+/g, '-')}.pdf`;
      const result = await shareReceiptOnWhatsApp(entry.partyPhone, blob, filename, message);
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

  async function handleViewExpenseReceipt(id: string) {
    const entry = data.entries.find((e) => e.id === id);
    if (!entry) return;
    showToast('Preparing receipt…');
    try {
      const { buildExpenseReceiptPdf } = await import('@/shared/lib/receipt');
      const blob = await buildExpenseReceiptPdf(entry, data);
      const url = URL.createObjectURL(blob);
      setPreview({ url, title: `Expense receipt — ${entry.partyName || 'Expense'}` });
    } catch (err) {
      console.error('Receipt generation failed:', err);
      showToast('Could not generate the receipt — please try again or report this.');
    }
  }

  async function handleSendExpenseReceipt(id: string) {
    const entry = data.entries.find((e) => e.id === id);
    if (!entry) return;
    showToast('Preparing receipt…');
    try {
      const { buildExpenseReceiptPdf, shareReceiptOnWhatsApp } = await import('@/shared/lib/receipt');
      const blob = await buildExpenseReceiptPdf(entry, data);
      const receiptNo = expenseReceiptNumber(data, entry);
      const message = `Expense receipt ${receiptNo} for ₹${entry.amount}${entry.partyName ? ' — paid to ' + entry.partyName : ''}. Please find the receipt attached.`;
      const filename = `expense-receipt-${(entry.partyName || 'expense').replace(/\s+/g, '-')}.pdf`;
      const result = await shareReceiptOnWhatsApp(entry.partyPhone, blob, filename, message);
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

  function handleImportEntries(rows: Record<string, string>[]): ImportResult {
    let success = 0;
    let failed = 0;

    update((prev) => {
      const newEntries: FinanceEntry[] = [];
      rows.forEach((row) => {
        const kindRaw = pickField(row, 'Kind', 'Type').trim().toLowerCase();
        const rowKind: FinanceKind = kindRaw === 'expense' ? 'expense' : 'donation';
        const rowCategory =
          pickField(row, 'Category', 'Purpose').trim() || (rowKind === 'donation' ? 'General Donation' : 'Other');
        const amt = parseFloat(pickField(row, 'Amount'));
        const rowPartyName = pickField(row, 'PartyName', 'Party Name', 'DonorName', 'Donor', 'PaidTo').trim();
        const rowPartyPhone = pickField(row, 'PartyPhone', 'Party Phone', 'Phone', 'Contact').trim();
        const rowDate = pickField(row, 'Date').trim() || todayStr();
        const paymentModeRaw = pickField(row, 'PaymentMode', 'Payment Mode').trim();
        const rowPaymentMode: PaymentMode = (PAYMENT_MODES as readonly string[]).includes(paymentModeRaw)
          ? (paymentModeRaw as PaymentMode)
          : 'Cash';
        const rowReceivedBy = pickField(row, 'ReceivedBy', 'Received By').trim();
        const rowNotes = pickField(row, 'Notes').trim();

        if (Number.isNaN(amt) || amt <= 0) {
          failed++;
          return;
        }

        newEntries.push({
          id: uid('fin'),
          kind: rowKind,
          category: rowCategory,
          amount: amt,
          partyName: rowPartyName,
          partyPhone: rowPartyPhone,
          date: rowDate,
          paymentMode: rowPaymentMode,
          receivedBy: rowReceivedBy,
          notes: rowNotes
        });
        success++;
      });
      return { entries: [...prev.entries, ...newEntries] };
    });

    if (success > 0) logActivity('Import finance entries', `Imported ${success} entrie(s) from Excel`);
    return { success, failed };
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <Receipt />
          </div>
          <div>
          <h2>All Records</h2>
          <p className="sub">Every donation and expense ever recorded.</p>
        </div>
      </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Link to="/finance/add" className="btn small">
            + Add entry
          </Link>
          <ImportExportBar
            entityLabel="donation/expense entries"
            sampleFilename="donation-entries-sample.xlsx"
            sampleHeaders={['Kind', 'Purpose', 'Amount', 'PartyName', 'PartyPhone', 'Date', 'PaymentMode', 'ReceivedBy', 'Notes']}
            sampleRows={[
              ['donation', 'Wheelchair sponsorship', 1000, 'Rajesh Shah', '9898989898', '2026-09-01', 'UPI', 'Amish Patel', 'Diwali donation'],
              ['expense', 'Auto fare for equipment pickup', 350, '', '', '2026-09-02', 'Cash', 'Amish Patel', '']
            ]}
            onImportRows={handleImportEntries}
            exportFilenameBase="donation-expense-entries"
            exportTitle="Donations & Expenses"
            exportHeaders={['Date', 'Type', 'Purpose', 'Party', 'Phone', 'Amount (₹)', 'Payment Mode', 'Received By', 'Notes']}
            getExportRows={() =>
              data.entries.map((e) => [
                fmtDate(e.date),
                e.kind === 'donation' ? 'Donation' : 'Expense',
                categoryDisplay(e),
                e.partyName || '—',
                e.partyPhone || '—',
                e.amount,
                e.paymentMode || '—',
                e.receivedBy || '—',
                e.notes || '—'
              ])
            }
          />
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search category, party, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as '' | FinanceKind)}>
          <option value="">All types</option>
          <option value="donation">Donations</option>
          <option value="expense">Expenses</option>
        </select>
      </div>

      <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Purpose</th>
              <th>Party</th>
              <th>Amount</th>
              <th>Notes</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--slate)', padding: 30 }}>
                  No records match.
                </td>
              </tr>
            ) : (
              pager.pageItems.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    <span className={`pill ${e.kind === 'donation' ? 'yes' : 'no'}`}>
                      {e.kind === 'donation' ? 'Donation' : 'Expense'}
                    </span>
                  </td>
                  <td>{categoryDisplay(e)}</td>
                  <td>
                    {e.partyName || '—'}
                    {e.partyPhone && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{e.partyPhone}</div>}
                  </td>
                  <td className="mono">₹{e.amount.toLocaleString('en-IN')}</td>
                  <td style={{ maxWidth: 220, color: 'var(--slate)', fontSize: 12 }}>{e.notes || '—'}</td>
                  <td className="col-actions">
                    <div className="row-actions">
                      {e.kind === 'donation' ? (
                        <>
                          <IconButton icon={<Eye />} label="View receipt" onClick={() => handleViewReceipt(e.id)} />
                          <WhatsAppShareButton iconOnly phone={e.partyPhone} onShare={() => handleSendReceipt(e.id)} />
                        </>
                      ) : (
                        <>
                          <IconButton icon={<Eye />} label="View receipt" onClick={() => handleViewExpenseReceipt(e.id)} />
                          <WhatsAppShareButton iconOnly phone={e.partyPhone} onShare={() => handleSendExpenseReceipt(e.id)} />
                        </>
                      )}
                      <IconLink icon={<Pencil />} label="Edit entry" to={`/finance/edit/${e.id}`} />
                      <IconButton
                        icon={<Trash2 />}
                        label="Delete entry"
                        variant="danger"
                        onClick={() => handleDelete(e.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))
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
          label="entries"
        />
      </div>

      {preview && <PdfPreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}
