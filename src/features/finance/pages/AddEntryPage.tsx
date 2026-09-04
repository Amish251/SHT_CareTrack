import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceData } from '../store';
import {
  DONATION_CATEGORIES,
  EXPENSE_CATEGORIES,
  PAYMENT_MODES,
  type FinanceEntry,
  type FinanceKind,
  type PaymentMode
} from '../types';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { fmtDate, todayStr } from '@/features/equipment-register/helpers';
import { logActivity } from '@/shared/lib/activityLog';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';

export default function AddEntryPage() {
  const [data, update] = useFinanceData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [kind, setKind] = useState<FinanceKind>('donation');
  const [category, setCategory] = useState(DONATION_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [date, setDate] = useState(todayStr());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [receivedBy, setReceivedBy] = useState(session.username);
  const [notes, setNotes] = useState('');

  const categories = kind === 'donation' ? DONATION_CATEGORIES : EXPENSE_CATEGORIES;

  function handleKindChange(next: FinanceKind) {
    setKind(next);
    setCategory(next === 'donation' ? DONATION_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0 || !date) return;

    update((prev) => ({
      entries: [
        ...prev.entries,
        {
          id: uid('fin'),
          kind,
          category,
          amount: amt,
          partyName: partyName.trim(),
          partyPhone: partyPhone.trim(),
          date,
          paymentMode,
          receivedBy: receivedBy.trim(),
          notes: notes.trim()
        }
      ]
    }));

    showToast(
      kind === 'donation'
        ? `Donation of ₹${amt} recorded — view or share the receipt from All Records.`
        : `Expense of ₹${amt} recorded.`
    );
    logActivity(
      kind === 'donation' ? 'Add donation' : 'Add expense',
      `${kind === 'donation' ? 'Donation of' : 'Expense of'} ₹${amt}${partyName.trim() ? ` — ${partyName.trim()}` : ''} (${category})`
    );
    navigate('/finance/records');
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
        <div>
          <h2>Add Entry</h2>
          <p className="sub">Record a donation received or an expense paid out.</p>
        </div>
      </div>

      <div className="panel">
        <ImportExportBar
          entityLabel="donation/expense entries"
          sampleFilename="donation-entries-sample.xlsx"
          sampleHeaders={['Kind', 'Category', 'Amount', 'PartyName', 'PartyPhone', 'Date', 'PaymentMode', 'ReceivedBy', 'Notes']}
          sampleRows={[
            ['donation', 'General Donation', 1000, 'Rajesh Shah', '9898989898', '2026-09-01', 'UPI', 'Amish Patel', 'Diwali donation'],
            ['expense', 'Transport', 350, 'Auto fare', '', '2026-09-02', 'Cash', 'Amish Patel', 'Equipment pickup']
          ]}
          onImportRows={handleImportEntries}
          exportFilenameBase="donation-expense-entries"
          exportTitle="Donations & Expenses"
          exportHeaders={['Date', 'Type', 'Category', 'Party', 'Phone', 'Amount (₹)', 'Payment Mode', 'Received By', 'Notes']}
          getExportRows={() =>
            data.entries.map((e) => [
              fmtDate(e.date),
              e.kind === 'donation' ? 'Donation' : 'Expense',
              e.category,
              e.partyName || '—',
              e.partyPhone || '—',
              e.amount,
              e.paymentMode || '—',
              e.receivedBy || '—',
              e.notes || '—'
            ])
          }
        />
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div>
              <label htmlFor="fin-kind">Entry type</label>
              <select id="fin-kind" value={kind} onChange={(e) => handleKindChange(e.target.value as FinanceKind)}>
                <option value="donation">Donation received</option>
                <option value="expense">Expense paid</option>
              </select>
            </div>
            <div>
              <label htmlFor="fin-category">{kind === 'donation' ? 'Purpose' : 'Category'}</label>
              <select id="fin-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fin-amount">Amount (₹)</label>
              <input
                type="number"
                id="fin-amount"
                min={1}
                step={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="fin-party">{kind === 'donation' ? 'Donor name' : 'Paid to'}</label>
              <input type="text" id="fin-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="fin-party-phone">Contact number {kind === 'donation' && '(for the receipt)'}</label>
              <input
                type="tel"
                id="fin-party-phone"
                placeholder="10-digit mobile"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="fin-date">Date</label>
              <input type="date" id="fin-date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="fin-mode">Payment mode</label>
              <select id="fin-mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fin-received-by">{kind === 'donation' ? 'Received by' : 'Paid out by'}</label>
              <input
                type="text"
                id="fin-received-by"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
              />
              {kind === 'donation' && (
                <p className="field-hint">Trust staff member who took the donation — printed on the receipt.</p>
              )}
            </div>
          </div>

          <div className="field-row">
            <div style={{ gridColumn: '1/-1' }}>
              <label htmlFor="fin-notes">Notes (optional)</label>
              <textarea id="fin-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn">
            Save entry
          </button>
        </form>
      </div>
    </div>
  );
}
