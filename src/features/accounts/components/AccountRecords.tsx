import { useMemo, useState } from 'react';
import { useAccountData } from '../store';
import {
  ACCOUNT_PAYMENT_MODES,
  type AccountEntry,
  type AccountEntryKind,
  type AccountPaymentMode
} from '../types';
import type { AccountConfig } from '../config';
import { accountDebitReceiptNumber, accountReceiptNumber, categoryDisplay } from '../helpers';
import { fmtDate, todayStr } from '@/features/equipment-register/helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';
import Pagination, { usePagination } from '@/shared/components/Pagination';
import { IconButton, IconLink } from '@/shared/components/RowActions';
import { Receipt, Eye, Pencil, Trash2 } from 'lucide-react';

export default function AccountRecords({ config }: { config: AccountConfig }) {
  const [data, update] = useAccountData(config.namespace);
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | AccountEntryKind>('');
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
        entry.kind === 'credit' ? `Delete ${config.title} credit` : `Delete ${config.title} debit`,
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
      const { buildAccountReceiptPdf } = await import('@/shared/lib/receipt');
      const blob = await buildAccountReceiptPdf(entry, data, config);
      const url = URL.createObjectURL(blob);
      setPreview({ url, title: `Receipt — ${entry.partyName || config.title}` });
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
      const { buildAccountReceiptPdf, shareReceiptOnWhatsApp } = await import('@/shared/lib/receipt');
      const blob = await buildAccountReceiptPdf(entry, data, config);
      const receiptNo = accountReceiptNumber(data, entry, config);
      const message = `${config.title} receipt ${receiptNo} for ₹${entry.amount} — thank you${entry.partyName ? ', ' + entry.partyName : ''}! Please find the receipt attached.`;
      const filename = `${config.slug}-receipt-${(entry.partyName || 'entry').replace(/\s+/g, '-')}.pdf`;
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
      const { buildAccountDebitReceiptPdf } = await import('@/shared/lib/receipt');
      const blob = await buildAccountDebitReceiptPdf(entry, data, config);
      const url = URL.createObjectURL(blob);
      setPreview({ url, title: `Expense receipt — ${entry.partyName || config.title}` });
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
      const { buildAccountDebitReceiptPdf, shareReceiptOnWhatsApp } = await import('@/shared/lib/receipt');
      const blob = await buildAccountDebitReceiptPdf(entry, data, config);
      const receiptNo = accountDebitReceiptNumber(data, entry, config);
      const message = `${config.title} expense receipt ${receiptNo} for ₹${entry.amount}${entry.partyName ? ' — paid to ' + entry.partyName : ''}. Please find the receipt attached.`;
      const filename = `${config.slug}-expense-receipt-${(entry.partyName || 'entry').replace(/\s+/g, '-')}.pdf`;
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
      const newEntries: AccountEntry[] = [];
      rows.forEach((row) => {
        const kindRaw = pickField(row, 'Kind', 'Type').trim().toLowerCase();
        const rowKind: AccountEntryKind = kindRaw === 'debit' ? 'debit' : 'credit';
        const rowCategory =
          pickField(row, 'Category', 'Purpose').trim() || (rowKind === 'credit' ? 'Other Income' : 'Other Expense');
        const amt = parseFloat(pickField(row, 'Amount'));
        const rowPartyName = pickField(row, 'PartyName', 'Party Name', 'Name').trim();
        const rowPartyPhone = pickField(row, 'PartyPhone', 'Party Phone', 'Phone', 'Contact').trim();
        const rowDate = pickField(row, 'Date').trim() || todayStr();
        const paymentModeRaw = pickField(row, 'PaymentMode', 'Payment Mode').trim();
        const rowPaymentMode: AccountPaymentMode = (ACCOUNT_PAYMENT_MODES as readonly string[]).includes(paymentModeRaw)
          ? (paymentModeRaw as AccountPaymentMode)
          : 'Cash';
        const rowHandledBy = pickField(row, 'HandledBy', 'Handled By', 'ReceivedBy', 'Received By').trim();
        const rowNotes = pickField(row, 'Notes').trim();

        if (Number.isNaN(amt) || amt <= 0) {
          failed++;
          return;
        }

        newEntries.push({
          id: uid('acct'),
          kind: rowKind,
          category: rowCategory,
          amount: amt,
          partyName: rowPartyName,
          partyPhone: rowPartyPhone,
          date: rowDate,
          paymentMode: rowPaymentMode,
          handledBy: rowHandledBy,
          notes: rowNotes
        });
        success++;
      });
      return { entries: [...prev.entries, ...newEntries] };
    });

    if (success > 0) logActivity(`Import ${config.title} entries`, `Imported ${success} entrie(s) from Excel`);
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
            <h2>{config.title} — All Records</h2>
            <p className="sub">Every credit and debit entry recorded for {config.title}.</p>
          </div>
        </div>
        <ImportExportBar
          addAction={{ label: '+ Add entry', to: `/${config.slug}/add` }}
          entityLabel={`${config.title} entries`}
          sampleFilename={`${config.slug}-sample.xlsx`}
          sampleHeaders={['Kind', 'Purpose', 'Amount', 'PartyName', 'PartyPhone', 'Date', 'PaymentMode', 'HandledBy', 'Notes']}
          sampleRows={[
            ['credit', 'Diwali donation', 1000, 'Rajesh Shah', '9898989898', '2026-09-01', 'UPI', 'Amish Patel', ''],
            ['debit', 'Printing pamphlets', 350, 'Local Press', '', '2026-09-02', 'Cash', 'Amish Patel', 'Event material']
          ]}
          onImportRows={handleImportEntries}
          exportFilenameBase={`${config.slug}-entries`}
          exportTitle={`${config.title} — Credit & Debit`}
          exportHeaders={['Date', 'Type', 'Purpose', 'Party', 'Phone', 'Amount (₹)', 'Payment Mode', 'Handled By', 'Notes']}
          getExportRows={() =>
            data.entries.map((e) => [
              e.date,
              e.kind === 'credit' ? 'Credit' : 'Debit',
              categoryDisplay(e),
              e.partyName || '—',
              e.partyPhone || '—',
              e.amount,
              e.paymentMode || '—',
              e.handledBy || '—',
              e.notes || '—'
            ])
          }
        />
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search category, party, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as '' | AccountEntryKind)}>
          <option value="">All types</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
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
                    <span className={`pill ${e.kind === 'credit' ? 'yes' : 'no'}`}>
                      {e.kind === 'credit' ? 'Credit' : 'Debit'}
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
                      {e.kind === 'credit' ? (
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
                      <IconLink icon={<Pencil />} label="Edit entry" to={`/${config.slug}/edit/${e.id}`} />
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
