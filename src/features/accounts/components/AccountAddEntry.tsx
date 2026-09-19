import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountData } from '../store';
import { ACCOUNT_PAYMENT_MODES, type AccountEntryKind, type AccountPaymentMode } from '../types';
import type { AccountConfig } from '../config';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { todayStr } from '@/features/equipment-register/helpers';
import { logActivity } from '@/shared/lib/activityLog';
import { HandCoins, IndianRupee, UserRound, Phone, CalendarDays } from 'lucide-react';

export default function AccountAddEntry({ config }: { config: AccountConfig }) {
  const [data, update] = useAccountData(config.namespace);
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [kind, setKind] = useState<AccountEntryKind>('credit');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [date, setDate] = useState(todayStr());
  const [paymentMode, setPaymentMode] = useState<AccountPaymentMode>('Cash');
  const [handledBy, setHandledBy] = useState(session.username);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function handleKindChange(next: AccountEntryKind) {
    setKind(next);
    setCategory('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (Number.isNaN(amt) || amt <= 0 || !date) return;
    if (!category.trim()) {
      showToast(kind === 'credit' ? 'Please say what this credit is for.' : 'Please say what this debit is for.');
      return;
    }

    setSaving(true);
    try {
      await update((prev) => ({
        entries: [
          ...prev.entries,
          {
            id: uid('acct'),
            kind,
            category: category.trim(),
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
    } catch {
      setSaving(false);
      showToast('Could not save — check your connection and try again.');
      return;
    }
    setSaving(false);

    showToast(`${kind === 'credit' ? 'Credit' : 'Debit'} of ₹${amt} recorded in ${config.title}.`);
    logActivity(
      kind === 'credit' ? `Add ${config.title} credit` : `Add ${config.title} debit`,
      `${kind === 'credit' ? 'Credit of' : 'Debit of'} ₹${amt}${partyName.trim() ? ` — ${partyName.trim()}` : ''} (${category})`
    );
    navigate(`/${config.slug}/records`);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <HandCoins />
          </div>
          <div>
          <h2>Add Entry — {config.title}</h2>
          <p className="sub">Record a credit (income) or debit (expense) for {config.title}.</p>
        </div>
      </div>
      </div>

      <div className="panel">
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
              <label htmlFor="acct-category">{kind === 'credit' ? 'What is this credit for?' : 'What is this debit for?'}</label>
              <input
                type="text"
                id="acct-category"
                required
                placeholder={kind === 'credit' ? 'e.g. Diwali donation' : 'e.g. Printing pamphlets'}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="acct-amount">Amount (₹)</label>
              <div className="field-icon">
                <IndianRupee />
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
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="acct-party">{kind === 'credit' ? 'Received from' : 'Paid to'}</label>
              <div className="field-icon">
                <UserRound />
                <input type="text" id="acct-party" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="acct-party-phone">Contact number</label>
              <div className="field-icon">
                <Phone />
                <input
                  type="tel"
                  id="acct-party-phone"
                  placeholder="10-digit mobile"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="acct-date">Date</label>
              <div className="field-icon">
                <CalendarDays />
                <input type="date" id="acct-date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
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

          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      </div>
    </div>
  );
}
