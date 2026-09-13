import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountData } from '../store';
import {
  ACCOUNT_PAYMENT_MODES,
  CREDIT_CATEGORIES,
  DEBIT_CATEGORIES,
  type AccountEntry,
  type AccountEntryKind,
  type AccountPaymentMode
} from '../types';
import type { AccountConfig } from '../config';
import { categoryDisplay } from '../helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { todayStr } from '@/features/equipment-register/helpers';
import { logActivity } from '@/shared/lib/activityLog';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';

export default function AccountAddEntry({ config }: { config: AccountConfig }) {
  const [data, update] = useAccountData(config.namespace);
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [kind, setKind] = useState<AccountEntryKind>('credit');
  const [category, setCategory] = useState(CREDIT_CATEGORIES[0]);
  const [categoryNote, setCategoryNote] = useState('');
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [date, setDate] = useState(todayStr());
  const [paymentMode, setPaymentMode] = useState<AccountPaymentMode>('Cash');
  const [handledBy, setHandledBy] = useState(session.username);
  const [notes, setNotes] = useState('');

  const categories = kind === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;

  function handleKindChange(next: AccountEntryKind) {
    setKind(next);
    setCategory(next === 'credit' ? CREDIT_CATEGORIES[0] : DEBIT_CATEGORIES[0]);
    setCategoryNote('');
  }

  function handleCategoryChange(next: string) {
    setCategory(next);
    if (next !== 'Other') setCategoryNote('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0 || !date) return;
    if (category === 'Other' && !categoryNote.trim()) {
      showToast('Please specify what "Other" means for this entry.');
      return;
    }

    update((prev) => ({
      entries: [
        ...prev.entries,
        {
          id: uid('acct'),
          kind,
          category,
          categoryNote: category === 'Other' ? categoryNote.trim() : '',
          amount: amt,
          partyName: partyName.trim(),
          partyPhone: partyPhone.trim(),
          date,
          paymentMode,
          handledBy: handledBy.trim(),
          notes: notes.trim()
        }
      ]
    }));

    showToast(`${kind === 'credit' ? 'Credit' : 'Debit'} of ₹${amt} recorded in ${config.title}.`);
    logActivity(
      kind === 'credit' ? `Add ${config.title} credit` : `Add ${config.title} debit`,
      `${kind === 'credit' ? 'Credit of' : 'Debit of'} ₹${amt}${partyName.trim() ? ` — ${partyName.trim()}` : ''} (${category})`
    );
    navigate(`/${config.slug}/records`);
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
        const rowCategoryNote = pickField(row, 'CategoryNote', 'Category Note', 'OtherDetail', 'Other Detail').trim();
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
          categoryNote: rowCategory === 'Other' ? rowCategoryNote : '',
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
        <div>
          <h2>Add Entry — {config.title}</h2>
          <p className="sub">Record a credit (income) or debit (expense) for {config.title}.</p>
        </div>
      </div>

      <div className="panel">
        <ImportExportBar
          entityLabel={`${config.title} entries`}
          sampleFilename={`${config.slug}-sample.xlsx`}
          sampleHeaders={[
            'Kind',
            'Category',
            'CategoryNote',
            'Amount',
            'PartyName',
            'PartyPhone',
            'Date',
            'PaymentMode',
            'HandledBy',
            'Notes'
          ]}
          sampleRows={[
            ['credit', 'Donation', '', 1000, 'Rajesh Shah', '9898989898', '2026-09-01', 'UPI', 'Amish Patel', 'Diwali donation'],
            ['debit', 'Other', 'Printing pamphlets', 350, 'Local Press', '', '2026-09-02', 'Cash', 'Amish Patel', 'Event material']
          ]}
          onImportRows={handleImportEntries}
          exportFilenameBase={`${config.slug}-entries`}
          exportTitle={`${config.title} — Credit & Debit`}
          exportHeaders={['Date', 'Type', 'Category', 'Party', 'Phone', 'Amount (₹)', 'Payment Mode', 'Handled By', 'Notes']}
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
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div>
              <label htmlFor="acct-kind">Entry type</label>
              <select id="acct-kind" value={kind} onChange={(e) => handleKindChange(e.target.value as AccountEntryKind)}>
                <option value="credit">Credit (income)</option>
                <option value="debit">Debit (expense)</option>
              </select>
            </div>
            <div>
              <label htmlFor="acct-category">Category</label>
              <select id="acct-category" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {category === 'Other' && (
              <div>
                <label htmlFor="acct-category-note">Please specify</label>
                <input
                  type="text"
                  id="acct-category-note"
                  required
                  placeholder="What is this for?"
                  value={categoryNote}
                  onChange={(e) => setCategoryNote(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="acct-amount">Amount (₹)</label>
              <input
                type="number"
                id="acct-amount"
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
              <label htmlFor="acct-party">{kind === 'credit' ? 'Received from' : 'Paid to'}</label>
              <input type="text" id="acct-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="acct-party-phone">Contact number</label>
              <input
                type="tel"
                id="acct-party-phone"
                placeholder="10-digit mobile"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="acct-date">Date</label>
              <input type="date" id="acct-date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="acct-mode">Payment mode</label>
              <select id="acct-mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as AccountPaymentMode)}>
                {ACCOUNT_PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="acct-handled-by">Handled by</label>
              <input
                type="text"
                id="acct-handled-by"
                value={handledBy}
                onChange={(e) => setHandledBy(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div style={{ gridColumn: '1/-1' }}>
              <label htmlFor="acct-notes">Notes (optional)</label>
              <textarea id="acct-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
