import { useMemo, useState } from 'react';
import { useFinanceData } from '../store';
import type { FinanceKind } from '../types';
import { donationReceiptNumber } from '../helpers';
import { fmtDate } from '@/features/equipment-register/helpers';
import { useToast } from '@/shared/components/ui/Toast';
import PdfPreviewModal from '@/shared/components/PdfPreviewModal';
import WhatsAppShareButton from '@/shared/components/WhatsAppShareButton';
import { logActivity } from '@/shared/lib/activityLog';

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
          const hay = `${e.partyName} ${e.category} ${e.notes}`.toLowerCase();
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
          ? 'Receipt shared.'
          : 'Receipt downloaded and WhatsApp opened — attach the file to send it.'
      );
    } catch (err) {
      console.error('Receipt generation failed:', err);
      showToast('Could not generate the receipt — please try again or report this.');
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>All Records</h2>
          <p className="sub">Every donation and expense ever recorded.</p>
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
                    <span className={`pill ${e.kind === 'donation' ? 'yes' : 'no'}`}>
                      {e.kind === 'donation' ? 'Donation' : 'Expense'}
                    </span>
                  </td>
                  <td>{e.category}</td>
                  <td>
                    {e.partyName || '—'}
                    {e.partyPhone && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{e.partyPhone}</div>}
                  </td>
                  <td className="mono">₹{e.amount.toLocaleString('en-IN')}</td>
                  <td style={{ maxWidth: 220, color: 'var(--slate)', fontSize: 12 }}>{e.notes || '—'}</td>
                  <td>
                    <div className="row-actions">
                      {e.kind === 'donation' && (
                        <>
                          <button type="button" className="btn small secondary" onClick={() => handleViewReceipt(e.id)}>
                            View
                          </button>
                          <WhatsAppShareButton phone={e.partyPhone} onShare={() => handleSendReceipt(e.id)} />
                        </>
                      )}
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
