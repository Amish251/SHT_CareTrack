import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEquipmentData } from '../store';
import { typeById, unitById } from '../helpers';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { logActivity } from '@/shared/lib/activityLog';
import { PencilLine } from 'lucide-react';

export default function EditAllocationPage() {
  const { id } = useParams();
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const allocation = data.allocations.find((a) => a.id === id);
  const type = allocation ? typeById(data, allocation.typeId) : undefined;
  const found = allocation ? unitById(data, allocation.unitId) : undefined;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [depositGiven, setDepositGiven] = useState(false);
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allocation) return;
    setName(allocation.patientName);
    setPhone(allocation.patientPhone);
    setTokenAmount(String(allocation.tokenAmount));
    setIssueDate(allocation.issueDate);
    setExpectedReturn(allocation.expectedReturn);
    setDepositGiven(allocation.depositGiven);
    setReceivedBy(allocation.depositReceivedBy);
    setNotes(allocation.notes);
  }, [allocation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!allocation) {
    return (
      <div className="empty">
        <div className="display">Record not found</div>
        <p>
          It may have been deleted. <Link to="/equipment-register/active">Back to Active Loans</Link>
        </p>
      </div>
    );
  }

  function handleDepositToggle(checked: boolean) {
    setDepositGiven(checked);
    if (checked && !receivedBy.trim()) setReceivedBy(session.username);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allocation) return;
    const trimmedName = name.trim();
    const token = parseFloat(tokenAmount);
    if (!trimmedName || !phone.trim() || Number.isNaN(token) || !issueDate) return;
    if (depositGiven && !receivedBy.trim()) {
      showToast('Enter who received the deposit.');
      return;
    }

    setSaving(true);
    try {
      await update((prev) => ({
        ...prev,
        allocations: prev.allocations.map((a) =>
          a.id !== allocation.id
            ? a
            : {
                ...a,
                patientName: trimmedName,
                patientPhone: phone.trim(),
                tokenAmount: token,
                issueDate,
                expectedReturn,
                depositGiven,
                depositReceivedBy: depositGiven ? receivedBy.trim() : '',
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
    logActivity('Edit loan record', `Updated record for ${trimmedName}`);
    navigate(allocation.status === 'active' ? '/equipment-register/active' : '/equipment-register/history');
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
          <p className="sub">
            {type ? type.name : '—'} {found ? `(${found.unit.label})` : ''} — equipment and unit can't be changed
            here; delete and re-issue if that's wrong.
          </p>
        </div>
      </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div>
              <label htmlFor="edit-name">Patient name</label>
              <input type="text" id="edit-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="edit-phone">Contact number</label>
              <input
                type="tel"
                id="edit-phone"
                required
                pattern="[0-9]{10}"
                title="Enter a 10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="field-row">
            <div>
              <label htmlFor="edit-token">Security deposit (token) amount (₹)</label>
              <input
                type="number"
                id="edit-token"
                min={0}
                step={1}
                required
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-issue-date">Issue date</label>
              <input
                type="date"
                id="edit-issue-date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="edit-return">Expected return date</label>
              <input
                type="date"
                id="edit-return"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
              />
            </div>
          </div>

          <div className="check-row">
            <input
              type="checkbox"
              id="edit-deposit-given"
              checked={depositGiven}
              onChange={(e) => handleDepositToggle(e.target.checked)}
            />
            <label htmlFor="edit-deposit-given">Deposit token has been received</label>
          </div>

          {depositGiven && (
            <div className="field-row">
              <div>
                <label htmlFor="edit-received-by">Deposit received by</label>
                <input
                  type="text"
                  id="edit-received-by"
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                />
                <p className="field-hint">Trust staff member who took the deposit — printed on the receipt.</p>
              </div>
            </div>
          )}

          <div className="field-row">
            <div style={{ gridColumn: '1/-1' }}>
              <label htmlFor="edit-notes">Notes</label>
              <textarea id="edit-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
