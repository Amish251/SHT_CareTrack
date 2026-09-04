import { useState, type FormEvent } from 'react';
import { useEquipmentData } from '../store';
import { engagedUnits, freeUnits } from '../helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';

export default function DashboardPage() {
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [qty, setQty] = useState('1');

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editToken, setEditToken] = useState('');

  const totalUnits = data.types.reduce((sum, t) => sum + t.units.length, 0);
  const totalEngaged = data.types.reduce((sum, t) => sum + engagedUnits(t).length, 0);
  const totalFree = totalUnits - totalEngaged;

  function handleAddType(e: FormEvent) {
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

    update((prev) => ({
      ...prev,
      types: [...prev.types, { id: typeId, name: trimmedName, tokenAmount: token, units }]
    }));

    logActivity('Add equipment type', `Added "${trimmedName}" with ${count} unit(s), ₹${token} deposit`);
    showToast(`${trimmedName} added with ${count} unit(s).`);
    setName('');
    setTokenAmount('');
    setQty('1');
  }

  function startEdit(typeId: string) {
    const t = data.types.find((x) => x.id === typeId);
    if (!t) return;
    setEditingTypeId(typeId);
    setEditName(t.name);
    setEditToken(String(t.tokenAmount));
  }

  function cancelEdit() {
    setEditingTypeId(null);
    setEditName('');
    setEditToken('');
  }

  function handleSaveEdit(e: FormEvent, typeId: string) {
    e.preventDefault();
    const t = data.types.find((x) => x.id === typeId);
    if (!t) return;
    const trimmedName = editName.trim();
    const token = parseFloat(editToken);
    if (!trimmedName || Number.isNaN(token)) return;

    update((prev) => ({
      ...prev,
      types: prev.types.map((type) => {
        if (type.id !== typeId) return type;
        // Keep auto-generated unit labels ("OldName #3") in sync with a renamed type.
        const units = type.units.map((u) =>
          u.label.startsWith(`${type.name} #`) ? { ...u, label: u.label.replace(`${type.name} #`, `${trimmedName} #`) } : u
        );
        return { ...type, name: trimmedName, tokenAmount: token, units };
      })
    }));

    logActivity('Edit equipment type', `"${t.name}" updated to "${trimmedName}", ₹${token} deposit`);
    showToast(`${trimmedName} updated.`);
    cancelEdit();
  }

  function handleAddUnit(typeId: string) {
    const t = data.types.find((x) => x.id === typeId);
    update((prev) => ({
      ...prev,
      types: prev.types.map((type) => {
        if (type.id !== typeId) return type;
        const n = type.units.length + 1;
        return {
          ...type,
          units: [...type.units, { id: uid('unit'), label: `${type.name} #${n}`, status: 'free' as const }]
        };
      })
    }));
    logActivity('Add unit', `Added a unit to "${t ? t.name : 'equipment'}"`);
    showToast(`Unit added to ${t ? t.name : 'equipment'}.`);
  }

  function handleRemoveUnit(typeId: string, unitId: string) {
    const t = data.types.find((x) => x.id === typeId);
    const unit = t?.units.find((u) => u.id === unitId);
    if (!t || !unit) return;
    if (unit.status !== 'free') {
      showToast("Can't remove — this unit is currently issued to a patient.");
      return;
    }
    if (!confirm(`Remove "${unit.label}"? This won't remove its past loan history.`)) return;
    update((prev) => ({
      ...prev,
      types: prev.types.map((type) =>
        type.id !== typeId ? type : { ...type, units: type.units.filter((u) => u.id !== unitId) }
      )
    }));
    logActivity('Remove unit', `Removed "${unit.label}" from "${t.name}"`);
    showToast(`${unit.label} removed.`);
  }

  function handleDeleteType(typeId: string) {
    const t = data.types.find((x) => x.id === typeId);
    if (!t) return;
    const engaged = engagedUnits(t).length;
    if (engaged > 0) {
      showToast(`Can't delete — ${engaged} unit(s) still engaged.`);
      return;
    }
    if (!confirm(`Delete "${t.name}" and all its units? This won't remove past history.`)) return;
    update((prev) => ({ ...prev, types: prev.types.filter((x) => x.id !== typeId) }));
    logActivity('Delete equipment type', `Deleted "${t.name}" and its ${t.units.length} unit(s)`);
    showToast(`${t.name} deleted.`);
    if (editingTypeId === typeId) cancelEdit();
  }

  function handleImportTypes(rows: Record<string, string>[]): ImportResult {
    let success = 0;
    let failed = 0;

    update((prev) => {
      let types = prev.types;
      rows.forEach((row) => {
        const trimmedName = pickField(row, 'Name', 'Equipment Name', 'EquipmentName').trim();
        const token = parseFloat(pickField(row, 'TokenAmount', 'Token Amount', 'Deposit', 'DepositAmount'));
        const count = parseInt(pickField(row, 'Quantity', 'Qty', 'Units'), 10);

        if (!trimmedName || Number.isNaN(token) || Number.isNaN(count) || count < 1) {
          failed++;
          return;
        }

        const typeId = uid('type');
        const units = Array.from({ length: count }, (_, i) => ({
          id: uid('unit'),
          label: `${trimmedName} #${i + 1}`,
          status: 'free' as const
        }));
        types = [...types, { id: typeId, name: trimmedName, tokenAmount: token, units }];
        success++;
      });
      return { ...prev, types };
    });

    if (success > 0) logActivity('Import equipment types', `Imported ${success} equipment type(s) from Excel`);
    return { success, failed };
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p className="sub">Live snapshot of every equipment type in the store room.</p>
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3 className="card-eyebrow">Equipment Types</h3>
          <div className="num mono" style={{ fontSize: 30 }}>
            {data.types.length}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Total Units</h3>
          <div className="num mono" style={{ fontSize: 30 }}>
            {totalUnits}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Currently Free</h3>
          <div className="num mono" style={{ fontSize: 30, color: 'var(--sage-deep)' }}>
            {totalFree}
          </div>
        </div>
        <div className="card">
          <h3 className="card-eyebrow">Currently Engaged</h3>
          <div className="num mono" style={{ fontSize: 30, color: 'var(--marigold-deep)' }}>
            {totalEngaged}
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Add new equipment type</h3>
        <ImportExportBar
          entityLabel="equipment types"
          sampleFilename="equipment-types-sample.xlsx"
          sampleHeaders={['Name', 'TokenAmount', 'Quantity']}
          sampleRows={[
            ['Wheelchair', 500, 3],
            ['Walking Stick', 100, 5]
          ]}
          onImportRows={handleImportTypes}
          exportFilenameBase="equipment-types"
          exportTitle="Equipment Types"
          exportHeaders={['Name', 'Token Amount (₹)', 'Total Units', 'Free', 'Engaged']}
          getExportRows={() =>
            data.types.map((t) => [t.name, t.tokenAmount, t.units.length, freeUnits(t).length, engagedUnits(t).length])
          }
        />
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
          <button type="submit" className="btn">
            Add equipment type
          </button>
        </form>
      </div>

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>By Equipment Type</h3>
      {data.types.length === 0 ? (
        <div className="empty">
          <div className="display">No equipment added yet</div>
          <p>Add your first equipment type above — like a wheelchair or foldable bed.</p>
        </div>
      ) : (
        data.types.map((t) => {
          const free = freeUnits(t).length;
          const engaged = engagedUnits(t).length;
          const isEditing = editingTypeId === t.id;
          return (
            <div className="panel" key={t.id}>
              {isEditing ? (
                <form onSubmit={(e) => handleSaveEdit(e, t.id)}>
                  <h3 style={{ marginBottom: 12 }}>Edit {t.name}</h3>
                  <div className="field-row">
                    <div>
                      <label htmlFor={`edit-type-name-${t.id}`}>Equipment name</label>
                      <input
                        type="text"
                        id={`edit-type-name-${t.id}`}
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-type-token-${t.id}`}>Security deposit (token) amount (₹)</label>
                      <input
                        type="number"
                        id={`edit-type-token-${t.id}`}
                        min={0}
                        step={1}
                        required
                        value={editToken}
                        onChange={(e) => setEditToken(e.target.value)}
                      />
                      <p className="field-hint">Doesn't change the deposit already recorded on past issues.</p>
                    </div>
                  </div>
                  <div className="row-actions">
                    <button type="submit" className="btn small">
                      Save changes
                    </button>
                    <button type="button" className="btn small secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="panel-head">
                    <div>
                      <h3 style={{ marginBottom: 4 }}>{t.name}</h3>
                      <div style={{ fontSize: '12.5px', color: 'var(--slate)' }}>
                        Security deposit amount:{' '}
                        <strong className="mono" style={{ color: 'var(--ink)' }}>
                          ₹{t.tokenAmount}
                        </strong>
                        {' · '}
                        {t.units.length} unit(s) · <span style={{ color: 'var(--sage-deep)' }}>{free} free</span>,{' '}
                        <span style={{ color: 'var(--marigold-deep)' }}>{engaged} engaged</span>
                      </div>
                    </div>
                    <div className="row-actions">
                      <button type="button" className="btn small secondary" onClick={() => startEdit(t.id)}>
                        Edit
                      </button>
                      <button type="button" className="btn small secondary" onClick={() => handleAddUnit(t.id)}>
                        + Add unit
                      </button>
                      <button type="button" className="btn small danger" onClick={() => handleDeleteType(t.id)}>
                        Delete type
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {t.units.length === 0 ? (
                      <span style={{ color: 'var(--slate)', fontSize: 12 }}>No units yet</span>
                    ) : (
                      t.units.map((u) => (
                        <span className={`unit-chip ${u.status}`} key={u.id}>
                          <span className="dot" />
                          {u.label}
                          {u.status === 'free' && (
                            <button
                              type="button"
                              className="unit-chip-remove"
                              onClick={() => handleRemoveUnit(t.id, u.id)}
                              title={`Remove ${u.label}`}
                              aria-label={`Remove ${u.label}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
