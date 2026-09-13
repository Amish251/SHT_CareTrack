import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccountData } from '../store';
import type { AccountEntryKind } from '../types';
import type { AccountConfig } from '../config';
import { accountDebitReceiptNumber, accountReceiptNumber, categoryDisplay } from '../helpers';
import { fmtDate } from '@/features/equipment-register/helpers';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import { Receipt } from 'lucide-react';

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
              <th>Category</th>
              <th>Party</th>
              <th>Amount</th>
              <th>Notes</th>
              <th />
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
              rows.map((e) => (
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
                  <td>
                    <div className="row-actions">
                      {e.kind === 'credit' ? (
                        <>
                          <button type="button" className="btn small secondary" onClick={() => handleViewReceipt(e.id)}>
                            View
                          </button>
                          <WhatsAppShareButton phone={e.partyPhone} onShare={() => handleSendReceipt(e.id)} />
                        </>
                      ) : (
                        <>
                          <button type="button" className="btn small secondary" onClick={() => handleViewExpenseReceipt(e.id)}>
                            View
                          </button>
                          <WhatsAppShareButton phone={e.partyPhone} onShare={() => handleSendExpenseReceipt(e.id)} />
                        </>
                      )}
                      <Link to={`/${config.slug}/edit/${e.id}`} className="btn small secondary">
                        Edit
                      </Link>
                      <button type="button" className="btn small danger" onClick={() => handleDelete(e.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {preview && <PdfPreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}
