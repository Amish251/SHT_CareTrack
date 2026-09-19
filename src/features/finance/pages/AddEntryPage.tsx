import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceData } from '../store';
import { PAYMENT_MODES, type FinanceKind, type PaymentMode } from '../types';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { todayStr } from '@/features/equipment-register/helpers';
import { logActivity } from '@/shared/lib/activityLog';
import { HandCoins, IndianRupee, UserRound, Phone, CalendarDays } from 'lucide-react';
import BackLink from '@/shared/components/BackLink';

export default function AddEntryPage() {
  const [data, update] = useFinanceData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [kind, setKind] = useState<FinanceKind>('donation');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [date, setDate] = useState(todayStr());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [receivedBy, setReceivedBy] = useState(session.username);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function handleKindChange(next: FinanceKind) {
    setKind(next);
    setCategory('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0 || !date) return;
    if (!category.trim()) {
      showToast(kind === 'donation' ? 'Please say what this donation is for.' : 'Please say what this expense is for.');
      return;
    }

    setSaving(true);
    try {
      await update((prev) => ({
        entries: [
          ...prev.entries,
          {
            id: uid('fin'),
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
        ]
      }));
    } catch {
      setSaving(false);
      showToast('Could not save — check your connection and try again.');
      return;
    }
    setSaving(false);

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

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <HandCoins />
          </div>
          <div>
            <h2>Add Entry</h2>
            <p className="sub">Record a donation received or an expense paid out.</p>
          </div>
        </div>
        <BackLink to="/finance/records" label="Back to Register" />
      </div>

      <div className="panel">
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
              <label htmlFor="fin-category">{kind === 'donation' ? 'What is this donation for?' : 'What is this expense for?'}</label>
              <input
                type="text"
                id="fin-category"
                required
                placeholder={kind === 'donation' ? 'e.g. Wheelchair sponsorship' : 'e.g. Auto fare for equipment pickup'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="fin-amount">Amount (₹)</label>
              <div className="field-icon">
                <IndianRupee />
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
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="fin-party">{kind === 'donation' ? 'Donor name' : 'Paid to'}</label>
              <div className="field-icon">
                <UserRound />
                <input type="text" id="fin-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="fin-party-phone">Contact number {kind === 'donation' && '(for the receipt)'}</label>
              <div className="field-icon">
                <Phone />
                <input
                  type="tel"
                  id="fin-party-phone"
                  placeholder="10-digit mobile"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="fin-date">Date</label>
              <div className="field-icon">
                <CalendarDays />
                <input type="date" id="fin-date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
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

          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      </div>
    </div>
  );
}
