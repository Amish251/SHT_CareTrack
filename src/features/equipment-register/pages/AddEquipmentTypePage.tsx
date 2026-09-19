import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEquipmentData } from '../store';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import { PackagePlus } from 'lucide-react';

export default function AddEquipmentTypePage() {
  const [, update] = useEquipmentData();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);

  async function handleAddType(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const token = parseFloat(tokenAmount);
    const count = parseInt(qty, 10);
    if (!trimmedName || Number.isNaN(token) || Number.isNaN(count) || count < 1) return;

    const typeId = uid('type');
    const units = Array.from({ length: count }, (_, i) => ({
      id: uid('unit'),
      label: `${trimmedName} #${i + 1}`,
      status: 'free' as const
    }));

    setSaving(true);
    try {
      await update((prev) => ({
        ...prev,
        types: [...prev.types, { id: typeId, name: trimmedName, tokenAmount: token, units }]
      }));
    } catch {
      setSaving(false);
      showToast('Could not save — check your connection and try again.');
      return;
    }
    setSaving(false);

    logActivity('Add equipment type', `Added "${trimmedName}" with ${count} unit(s), ₹${token} deposit`);
    showToast(`${trimmedName} added with ${count} unit(s).`);
    navigate('/equipment-register/types');
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <PackagePlus />
          </div>
          <div>
            <h2>Add Equipment Type</h2>
            <p className="sub">Add a new kind of equipment and how many units of it the Trust has.</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={handleAddType}>
          <div className="field-row">
            <div>
              <label htmlFor="type-name">Equipment name</label>
              <input
                type="text"
                id="type-name"
                placeholder="e.g. Wheelchair"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="type-token">Security deposit (token) amount (₹)</label>
              <input
                type="number"
                id="type-token"
                min={0}
                step={1}
                placeholder="e.g. 500"
                required
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
              />
              <p className="field-hint">Refundable — not a payment to the Trust.</p>
            </div>
            <div>
              <label htmlFor="type-qty">Number of units available</label>
              <input
                type="number"
                id="type-qty"
                min={1}
                step={1}
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Add equipment type'}
          </button>
        </form>
      </div>
    </div>
  );
}
