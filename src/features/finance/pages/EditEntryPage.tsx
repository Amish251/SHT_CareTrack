import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFinanceData } from '../store';
import { PAYMENT_MODES, type FinanceKind, type PaymentMode } from '../types';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import { PencilLine, IndianRupee, UserRound, Phone, CalendarDays } from 'lucide-react';

/**
 * Edits an existing donation/expense entry. Same field set as AddEntryPage.
 * Since receipts are always built on-demand from the current entry data
 * (see shared/lib/receipt.ts), saving changes here is all that's needed for
 * the receipt PDF to reflect the edit the next time it's viewed or shared —
 * same pattern as Edit Record in Equipment Register.
 */
export default function EditEntryPage() {
  const { id } = useParams();
  const [data, update] = useFinanceData();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const entry = data.entries.find((e) => e.id === id);

  const [kind, setKind] = useState<FinanceKind>('donation');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [date, setDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setKind(entry.kind);
    setCategory(entry.category);
    setAmount(String(entry.amount));
    setPartyName(entry.partyName);
    setPartyPhone(entry.partyPhone);
    setDate(entry.date);
    setPaymentMode(entry.paymentMode);
    setReceivedBy(entry.receivedBy);
    setNotes(entry.notes);
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) {
    return (
      <div className="empty">
        <div className="display">Record not found</div>
        <p>
          It may have been deleted. <Link to="/finance/records">Back to All Records</Link>
        </p>
      </div>
    );
  }

  function handleKindChange(next: FinanceKind) {
    setKind(next);
    setCategory('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!entry) return;
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0 || !date) return;
    if (!category.trim()) {
      showToast(kind === 'donation' ? 'Please say what this donation is for.' : 'Please say what this expense is for.');
      return;
    }

    setSaving(true);
    try {
      await update((prev) => ({
        entries: prev.entries.map((e) =>
          e.id !== entry.id
            ? e
            : {
                ...e,
                kind,
                category: category.trim(),
                amount: amt,
                partyName: partyName.trim(),
                partyPhone: partyPhone.trim(),
                date,
                paymentMode,
                receivedBy: receivedBy.trim(),
                notes: notes.trim()
              }
        )
      }));
    } catch {
      setSaving(false);
      showToast('Could not save — check your connection and try again.');
      return;
    }
    setSaving(false);

    showToast('Record updated.');
    logActivity(
      kind === 'donation' ? 'Edit donation' : 'Edit expense',
      `Updated ${kind} of ₹${amt}${partyName.trim() ? ` — ${partyName.trim()}` : ''}`
    );
    navigate('/finance/records');
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <PencilLine />
          </div>
          <div>
          <h2>Edit Record</h2>
          <p className="sub">Changes here are reflected the next time this record's receipt is viewed or shared.</p>
        </div>
      </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div>
              <label htmlFor="edit-fin-kind">Entry type</label>
              <select id="edit-fin-kind" value={kind} onChange={(e) => handleKindChange(e.target.value as FinanceKind)}>
                <option value="donation">Donation received</option>
                <option value="expense">Expense paid</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-fin-category">{kind === 'donation' ? 'What is this donation for?' : 'What is this expense for?'}</label>
              <input
                type="text"
                id="edit-fin-category"
                required
                placeholder={kind === 'donation' ? 'e.g. Wheelchair sponsorship' : 'e.g. Auto fare for equipment pickup'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-fin-amount">Amount (₹)</label>
              <div className="field-icon">
                <IndianRupee />
                <input
                  type="number"
                  id="edit-fin-amount"
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
              <label htmlFor="edit-fin-party">{kind === 'donation' ? 'Donor name' : 'Paid to'}</label>
              <div className="field-icon">
                <UserRound />
                <input type="text" id="edit-fin-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="edit-fin-party-phone">Contact number {kind === 'donation' && '(for the receipt)'}</label>
              <div className="field-icon">
                <Phone />
                <input
                  type="tel"
                  id="edit-fin-party-phone"
                  placeholder="10-digit mobile"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-fin-date">Date</label>
              <div className="field-icon">
                <CalendarDays />
                <input type="date" id="edit-fin-date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="edit-fin-mode">Payment mode</label>
              <select id="edit-fin-mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-fin-received-by">{kind === 'donation' ? 'Received by' : 'Paid out by'}</label>
              <input
                type="text"
                id="edit-fin-received-by"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div style={{ gridColumn: '1/-1' }}>
              <label htmlFor="edit-fin-notes">Notes (optional)</label>
              <textarea id="edit-fin-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="row-actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
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
