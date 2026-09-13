import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAccountData } from '../store';
import {
  ACCOUNT_PAYMENT_MODES,
  CREDIT_CATEGORIES,
  DEBIT_CATEGORIES,
  type AccountEntryKind,
  type AccountPaymentMode
} from '../types';
import type { AccountConfig } from '../config';
import { isOtherCategory } from '../helpers';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import { PencilLine, IndianRupee, UserRound, Phone, CalendarDays } from 'lucide-react';

/**
 * Edits an existing credit/debit entry in one of the named account ledgers.
 * Same field set as AccountAddEntry — since receipts are always built
 * on-demand from the current entry data (see shared/lib/receipt.ts), saving
 * changes here is all that's needed for the receipt PDF to reflect the edit
 * the next time someone views or shares it, same as equipment's Edit Record.
 */
export default function AccountEditEntry({ config }: { config: AccountConfig }) {
  const { id } = useParams();
  const [data, update] = useAccountData(config.namespace);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const entry = data.entries.find((e) => e.id === id);

  const [kind, setKind] = useState<AccountEntryKind>('credit');
  const [category, setCategory] = useState('');
  const [categoryNote, setCategoryNote] = useState('');
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [date, setDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<AccountPaymentMode>('Cash');
  const [handledBy, setHandledBy] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!entry) return;
    setKind(entry.kind);
    setCategory(entry.category);
    setCategoryNote(entry.categoryNote);
    setAmount(String(entry.amount));
    setPartyName(entry.partyName);
    setPartyPhone(entry.partyPhone);
    setDate(entry.date);
    setPaymentMode(entry.paymentMode);
    setHandledBy(entry.handledBy);
    setNotes(entry.notes);
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) {
    return (
      <div className="empty">
        <div className="display">Record not found</div>
        <p>
          It may have been deleted. <Link to={`/${config.slug}/records`}>Back to {config.title} records</Link>
        </p>
      </div>
    );
  }

  const categories = kind === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;

  function handleKindChange(next: AccountEntryKind) {
    setKind(next);
    const nextCategories = next === 'credit' ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;
    setCategory(nextCategories[0]);
    setCategoryNote('');
  }

  function handleCategoryChange(next: string) {
    setCategory(next);
    if (!isOtherCategory(next)) setCategoryNote('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!entry) return;
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0 || !date) return;
    if (isOtherCategory(category) && !categoryNote.trim()) {
      showToast('Please specify what "Other" means for this entry.');
      return;
    }

    update((prev) => ({
      entries: prev.entries.map((e) =>
        e.id !== entry.id
          ? e
          : {
              ...e,
              kind,
              category,
              categoryNote: isOtherCategory(category) ? categoryNote.trim() : '',
              amount: amt,
              partyName: partyName.trim(),
              partyPhone: partyPhone.trim(),
              date,
              paymentMode,
              handledBy: handledBy.trim(),
              notes: notes.trim()
            }
      )
    }));

    showToast('Record updated.');
    logActivity(`Edit ${config.title} entry`, `Updated ${kind} of ₹${amt}${partyName.trim() ? ` — ${partyName.trim()}` : ''}`);
    navigate(`/${config.slug}/records`);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <PencilLine />
          </div>
          <div>
          <h2>Edit Record — {config.title}</h2>
          <p className="sub">Changes here are reflected the next time this record's receipt is viewed or shared.</p>
        </div>
      </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div>
              <label htmlFor="edit-acct-kind">Entry type</label>
              <select id="edit-acct-kind" value={kind} onChange={(e) => handleKindChange(e.target.value as AccountEntryKind)}>
                <option value="credit">Credit (income)</option>
                <option value="debit">Debit (expense)</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-acct-category">Category</label>
              <select id="edit-acct-category" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {isOtherCategory(category) && (
              <div>
                <label htmlFor="edit-acct-category-note">Please specify</label>
                <input
                  type="text"
                  id="edit-acct-category-note"
                  required
                  placeholder="What is this for?"
                  value={categoryNote}
                  onChange={(e) => setCategoryNote(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="edit-acct-amount">Amount (₹)</label>
              <div className="field-icon">
                <IndianRupee />
                <input
                  type="number"
                  id="edit-acct-amount"
                  min={1}
                  step={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="edit-acct-party">{kind === 'credit' ? 'Received from' : 'Paid to'}</label>
              <div className="field-icon">
                <UserRound />
                <input type="text" id="edit-acct-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="edit-acct-party-phone">Contact number</label>
              <div className="field-icon">
                <Phone />
                <input
                  type="tel"
                  id="edit-acct-party-phone"
                  placeholder="10-digit mobile"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-acct-date">Date</label>
              <div className="field-icon">
                <CalendarDays />
                <input type="date" id="edit-acct-date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="edit-acct-mode">Payment mode</label>
              <select id="edit-acct-mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as AccountPaymentMode)}>
                {ACCOUNT_PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-acct-handled-by">Handled by</label>
              <input
                type="text"
                id="edit-acct-handled-by"
                value={handledBy}
                onChange={(e) => setHandledBy(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div style={{ gridColumn: '1/-1' }}>
              <label htmlFor="edit-acct-notes">Notes (optional)</label>
              <textarea id="edit-acct-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="row-actions">
            <button type="submit" className="btn">
              Save changes
            </button>
            <button type="button" className="btn secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
