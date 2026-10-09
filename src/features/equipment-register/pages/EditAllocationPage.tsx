import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEquipmentData } from '../store';
import { allocationsInGroup, freeUnits, groupKey, typeById, unitById } from '../helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { logActivity } from '@/shared/lib/activityLog';
import { PencilLine, IndianRupee } from 'lucide-react';

/** One editable equipment line. `allocId` is set for lines that already exist in the record. */
interface LineItem {
  key: string;
  allocId: string | null;
  typeId: string;
  unitId: string;
  tokenAmount: string;
}

export default function EditAllocationPage() {
  const { id } = useParams();
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const allocation = data.allocations.find((a) => a.id === id);
  const group = useMemo(() => (allocation ? allocationsInGroup(data, allocation) : []), [data, allocation]);
  const activeInGroup = group.filter((a) => a.status === 'active');
  const returnedInGroup = group.filter((a) => a.status === 'returned');
  // Equipment can only be changed while the record is still out with the patient.
  const canEditItems = allocation?.status === 'active';

  const [lines, setLines] = useState<LineItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expectedReturn, setExpectedReturn] = useState('');
  const [depositGiven, setDepositGiven] = useState(false);
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allocation) return;
    setName(allocation.patientName);
    setPhone(allocation.patientPhone);
    setIssueDate(allocation.issueDate);
    setExpectedReturn(allocation.expectedReturn);
    setDepositGiven(allocation.depositGiven);
    setReceivedBy(allocation.depositReceivedBy);
    setNotes(allocation.notes);
    setTokenAmount(String(allocation.tokenAmount));
    setLines(
      allocationsInGroup(data, allocation)
        .filter((a) => a.status === 'active')
        .map((a) => ({
          key: a.id,
          allocId: a.id,
          typeId: a.typeId,
          unitId: a.unitId,
          tokenAmount: String(a.tokenAmount)
        }))
    );
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

  // ---- line helpers -------------------------------------------------------
  const unitsTakenByOtherLines = (currentKey: string) => {
    const taken = new Set<string>();
    for (const l of lines) if (l.key !== currentKey && l.unitId) taken.add(l.unitId);
    return taken;
  };

  /** Free units of the line's type, plus the unit this line already holds (so it stays selectable). */
  function availableUnitsForLine(line: LineItem) {
    const type = data.types.find((t) => t.id === line.typeId);
    if (!type) return [];
    const taken = unitsTakenByOtherLines(line.key);
    const ownUnit = line.allocId ? group.find((a) => a.id === line.allocId)?.unitId : undefined;
    return type.units.filter((u) => !taken.has(u.id) && (u.status === 'free' || u.id === ownUnit));
  }

  function handleLineTypeChange(key: string, typeId: string) {
    const type = data.types.find((t) => t.id === typeId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const taken = unitsTakenByOtherLines(key);
        const firstFree = type ? freeUnits(type).find((u) => !taken.has(u.id)) : undefined;
        return { ...l, typeId, unitId: firstFree?.id ?? '', tokenAmount: type ? String(type.tokenAmount) : '' };
      })
    );
  }

  function handleLineUnitChange(key: string, unitId: string) {
    setLines((prev) => prev.map((l) => (l.key !== key ? l : { ...l, unitId })));
  }

  function handleLineTokenChange(key: string, value: string) {
    setLines((prev) => prev.map((l) => (l.key !== key ? l : { ...l, tokenAmount: value })));
  }

  function handleAddLine() {
    setLines((prev) => [...prev, { key: uid('line'), allocId: null, typeId: '', unitId: '', tokenAmount: '' }]);
  }

  function handleRemoveLine(key: string) {
    const totalItems = lines.length + returnedInGroup.length;
    if (totalItems <= 1) {
      showToast("A record needs at least one item. Delete the record instead if it was issued by mistake.");
      return;
    }
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const totalToken = lines.reduce((sum, l) => sum + (parseFloat(l.tokenAmount) || 0), 0);

  function handleDepositToggle(checked: boolean) {
    setDepositGiven(checked);
    if (checked && !receivedBy.trim()) setReceivedBy(session.username);
  }

  // ---- save ---------------------------------------------------------------
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allocation) return;
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone || !issueDate) return;
    if (depositGiven && !receivedBy.trim()) {
      showToast('Enter who received the deposit.');
      return;
    }

    if (canEditItems) {
      if (lines.length + returnedInGroup.length === 0) {
        showToast('Add at least one item.');
        return;
      }
      if (lines.some((l) => !l.typeId || !l.unitId)) {
        showToast('Select an equipment type and a unit for every line.');
        return;
      }
      const ids = lines.map((l) => l.unitId);
      if (new Set(ids).size !== ids.length) {
        showToast('The same unit is selected twice — pick a different one.');
        return;
      }
      if (lines.some((l) => Number.isNaN(parseFloat(l.tokenAmount)))) {
        showToast('Enter a deposit amount for every line.');
        return;
      }
    } else if (Number.isNaN(parseFloat(tokenAmount))) {
      showToast('Enter a deposit amount.');
      return;
    }

    const gKey = groupKey(allocation);
    const shared = {
      patientName: trimmedName,
      patientPhone: trimmedPhone,
      issueDate,
      expectedReturn,
      depositGiven,
      depositReceivedBy: depositGiven ? receivedBy.trim() : '',
      notes: notes.trim()
    };

    setSaving(true);
    try {
      await update((prev) => {
        // Work from the freshest data, not the render-time snapshot.
        const current = prev.allocations.find((a) => a.id === allocation.id);
        const currentGroup = current ? prev.allocations.filter((a) => groupKey(a) === gKey) : [];

        if (!canEditItems) {
          // Returned record: details only, no equipment changes.
          return {
            ...prev,
            allocations: prev.allocations.map((a) =>
              a.id !== allocation.id ? a : { ...a, ...shared, tokenAmount: parseFloat(tokenAmount) }
            )
          };
        }

        const keptIds = new Set(lines.filter((l) => l.allocId).map((l) => l.allocId as string));
        const removed = currentGroup.filter((a) => a.status === 'active' && !keptIds.has(a.id));
        const freed = new Set<string>(removed.map((a) => a.unitId));
        const engaged = new Set<string>();

        // Existing lines: update, and swap unit if it changed.
        const updatedExisting = new Map<string, { typeId: string; unitId: string; tokenAmount: number }>();
        for (const l of lines) {
          if (!l.allocId) continue;
          const orig = currentGroup.find((a) => a.id === l.allocId);
          if (!orig) continue;
          if (orig.unitId !== l.unitId) {
            freed.add(orig.unitId);
            engaged.add(l.unitId);
          }
          updatedExisting.set(l.allocId, { typeId: l.typeId, unitId: l.unitId, tokenAmount: parseFloat(l.tokenAmount) });
        }

        // New lines: create allocations in the same group.
        const created = lines
          .filter((l) => !l.allocId)
          .map((l) => {
            engaged.add(l.unitId);
            return {
              id: uid('alloc'),
              groupId: gKey,
              unitId: l.unitId,
              typeId: l.typeId,
              ...shared,
              tokenAmount: parseFloat(l.tokenAmount),
              returnDate: '',
              status: 'active' as const,
            };
          });

        // Guard: every unit we're about to take must be free (or one we're releasing in this same save).
        for (const t of prev.types) {
          for (const u of t.units) {
            if (engaged.has(u.id) && u.status !== 'free' && !freed.has(u.id)) {
              throw new Error('unit-taken');
            }
          }
        }

        const allocations = prev.allocations
          .filter((a) => !removed.some((r) => r.id === a.id))
          .map((a) => {
            if (groupKey(a) !== gKey) return a;
            const upd = updatedExisting.get(a.id);
            return upd ? { ...a, ...shared, ...upd } : { ...a, ...shared };
          });

        const types = prev.types.map((t) => ({
          ...t,
          units: t.units.map((u) => {
            if (engaged.has(u.id)) return { ...u, status: 'engaged' as const };
            if (freed.has(u.id)) return { ...u, status: 'free' as const };
            return u;
          })
        }));

        return { types, allocations: [...allocations, ...created] };
      });
    } catch (err) {
      setSaving(false);
      showToast(
        err instanceof Error && err.message === 'unit-taken'
          ? 'One of the selected units was just taken by someone else — please reselect.'
          : 'Could not save — check your connection and try again.'
      );
      return;
    }
    setSaving(false);

    showToast('Record updated.');
    logActivity('Edit loan record', `Updated record for ${trimmedName} (${canEditItems ? lines.length + returnedInGroup.length : 1} item(s))`);
    navigate(allocation.status === 'active' ? '/equipment-register/active' : '/equipment-register/history');
  }

  const type = typeById(data, allocation.typeId);
  const found = unitById(data, allocation.unitId);

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
              {canEditItems
                ? 'Change patient details, or add, swap and remove the equipment issued in this record.'
                : `${type ? type.name : '—'} ${found ? `(${found.unit.label})` : ''} — returned records can't have their equipment changed.`}
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={handleSubmit}>
          {canEditItems && (
            <>
              <label style={{ marginBottom: 8 }}>Equipment in this record</label>
              {lines.map((line, i) => {
                const selectedType = data.types.find((t) => t.id === line.typeId);
                const availableUnits = availableUnitsForLine(line);
                return (
                  <div
                    key={line.key}
                    className="field-row"
                    style={{
                      alignItems: 'flex-end',
                      marginBottom: 10,
                      paddingBottom: 10,
                      borderBottom: i < lines.length - 1 || returnedInGroup.length > 0 ? '1px dashed var(--line)' : 'none'
                    }}
                  >
                    <div>
                      <label htmlFor={`edit-type-${line.key}`}>
                        Equipment type {!line.allocId && <span className="pill yes" style={{ marginLeft: 4 }}>New</span>}
                      </label>
                      <select
                        id={`edit-type-${line.key}`}
                        required
                        value={line.typeId}
                        onChange={(e) => handleLineTypeChange(line.key, e.target.value)}
                      >
                        <option value="">Select equipment…</option>
                        {data.types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`edit-unit-${line.key}`}>Unit</label>
                      <select
                        id={`edit-unit-${line.key}`}
                        required
                        value={line.unitId}
                        onChange={(e) => handleLineUnitChange(line.key, e.target.value)}
                        disabled={!selectedType}
                      >
                        {!selectedType ? (
                          <option value="">Select equipment type first</option>
                        ) : availableUnits.length === 0 ? (
                          <option value="">No units available — all engaged</option>
                        ) : (
                          <>
                            {!line.unitId && <option value="">Select unit…</option>}
                            {availableUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.label}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`edit-token-${line.key}`}>Deposit (₹)</label>
                      <div className="field-icon">
                        <IndianRupee />
                        <input
                          type="number"
                          id={`edit-token-${line.key}`}
                          min={0}
                          step={1}
                          required
                          value={line.tokenAmount}
                          onChange={(e) => handleLineTokenChange(line.key, e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ flex: '0 0 auto' }}>
                      <button type="button" className="btn small danger" onClick={() => handleRemoveLine(line.key)}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}

              {returnedInGroup.map((a) => {
                const t = typeById(data, a.typeId);
                const u = unitById(data, a.unitId);
                return (
                  <div key={a.id} className="field-hint" style={{ marginBottom: 8 }}>
                    {t ? t.name : '—'} ({u ? u.unit.label : '—'}) · ₹{a.tokenAmount} · already returned (can't be edited)
                  </div>
                );
              })}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <button type="button" className="btn small secondary" onClick={handleAddLine}>
                  + Add another equipment
                </button>
                {lines.length > 1 && (
                  <span className="mono" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    Total deposit: ₹{totalToken}
                  </span>
                )}
              </div>
            </>
          )}

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
            {!canEditItems && (
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
            )}
            <div>
              <label htmlFor="edit-issue-date">Issue date</label>
              <input type="date" id="edit-issue-date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="edit-return">Expected return date</label>
              <input type="date" id="edit-return" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
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
                <input type="text" id="edit-received-by" required value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
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
