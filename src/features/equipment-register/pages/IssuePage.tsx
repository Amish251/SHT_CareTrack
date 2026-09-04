import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEquipmentData } from '../store';
import { fmtDate, freeUnits, todayStr, typeById, unitById } from '../helpers';
import { uid } from '@/shared/lib/storage';
import { useToast } from '@/shared/components/ui/Toast';
import { useAuth } from '@/shared/components/AuthGate';
import { logActivity } from '@/shared/lib/activityLog';
import ImportExportBar, { type ImportResult } from '@/shared/components/ImportExportBar';
import { pickField } from '@/shared/lib/tableExport';

interface LineItem {
  key: string;
  typeId: string;
  unitId: string;
  tokenAmount: string;
}

function emptyLine(): LineItem {
  return { key: uid('line'), typeId: '', unitId: '', tokenAmount: '' };
}

export default function IssuePage() {
  const [data, update] = useEquipmentData();
  const { showToast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [issueDate, setIssueDate] = useState(todayStr());
  const [expectedReturn, setExpectedReturn] = useState('');
  const [depositGiven, setDepositGiven] = useState(false);
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Units already picked by another line, per type, so the same unit can't be issued twice in one visit.
  const unitsTakenByOtherLines = (currentKey: string) => {
    const taken = new Set<string>();
    for (const l of lines) {
      if (l.key !== currentKey && l.unitId) taken.add(l.unitId);
    }
    return taken;
  };

  function availableUnitsForLine(line: LineItem) {
    const type = data.types.find((t) => t.id === line.typeId);
    if (!type) return [];
    const taken = unitsTakenByOtherLines(line.key);
    return freeUnits(type).filter((u) => !taken.has(u.id));
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

  function handleLineTokenChange(key: string, tokenAmount: string) {
    setLines((prev) => prev.map((l) => (l.key !== key ? l : { ...l, tokenAmount })));
  }

  function handleAddLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function handleRemoveLine(key: string) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  const totalToken = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.tokenAmount) || 0), 0),
    [lines]
  );

  function handleDepositToggle(checked: boolean) {
    setDepositGiven(checked);
    if (checked && !receivedBy.trim()) setReceivedBy(session.username);
  }

  function resetForm() {
    setLines([emptyLine()]);
    setName('');
    setPhone('');
    setIssueDate(todayStr());
    setExpectedReturn('');
    setDepositGiven(false);
    setReceivedBy('');
    setNotes('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (lines.some((l) => !l.typeId || !l.unitId)) {
      showToast('Select an equipment type and a free unit for every line.');
      return;
    }
    const unitIds = lines.map((l) => l.unitId);
    if (new Set(unitIds).size !== unitIds.length) {
      showToast('The same unit is selected twice — pick a different one.');
      return;
    }
    for (const l of lines) {
      const type = data.types.find((t) => t.id === l.typeId);
      const unit = type?.units.find((u) => u.id === l.unitId);
      if (!type || !unit || unit.status !== 'free') {
        showToast('One of the selected units is no longer free — please refresh.');
        return;
      }
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone || !issueDate) return;
    if (depositGiven && !receivedBy.trim()) {
      showToast('Enter who received the deposit.');
      return;
    }
    if (lines.some((l) => Number.isNaN(parseFloat(l.tokenAmount)))) {
      showToast('Enter a deposit amount for every line.');
      return;
    }

    const groupId = uid('grp');
    const newAllocations = lines.map((l) => ({
      id: uid('alloc'),
      groupId,
      unitId: l.unitId,
      typeId: l.typeId,
      patientName: trimmedName,
      patientPhone: trimmedPhone,
      tokenAmount: parseFloat(l.tokenAmount),
      depositGiven,
      depositReceivedBy: depositGiven ? receivedBy.trim() : '',
      issueDate,
      expectedReturn: expectedReturn || '',
      returnDate: '',
      status: 'active' as const,
      notes: notes.trim()
    }));
    const engagedUnitIds = new Set(unitIds);

    update((prev) => ({
      types: prev.types.map((t) => ({
        ...t,
        units: t.units.map((u) => (engagedUnitIds.has(u.id) ? { ...u, status: 'engaged' } : u))
      })),
      allocations: [...prev.allocations, ...newAllocations]
    }));

    showToast(
      lines.length > 1
        ? `${lines.length} items issued to ${trimmedName}.`
        : `Equipment issued to ${trimmedName}.`
    );
    logActivity(
      'Issue equipment',
      `Issued ${lines.length} item(s) to ${trimmedName} (₹${totalToken} deposit)`
    );
    resetForm();
    navigate('/equipment-register/active');
  }

  function handleImportIssues(rows: Record<string, string>[]): ImportResult {
    let success = 0;
    let failed = 0;

    update((prev) => {
      let types = prev.types;
      const newAllocations: typeof prev.allocations = [];

      rows.forEach((row) => {
        const patientName = pickField(row, 'PatientName', 'Patient Name', 'Name').trim();
        const phone = pickField(row, 'Phone', 'PatientPhone', 'Contact', 'ContactNumber').trim();
        const typeName = pickField(row, 'EquipmentType', 'Equipment Type', 'Equipment').trim();
        const token = parseFloat(pickField(row, 'TokenAmount', 'Token Amount', 'Deposit'));
        const rowIssueDate = pickField(row, 'IssueDate', 'Issue Date').trim() || todayStr();
        const rowExpectedReturn = pickField(row, 'ExpectedReturn', 'Expected Return').trim();
        const depositGivenRaw = pickField(row, 'DepositGiven', 'Deposit Given', 'Deposit Received').trim().toLowerCase();
        const rowReceivedBy = pickField(row, 'ReceivedBy', 'Received By', 'DepositReceivedBy').trim();
        const rowNotes = pickField(row, 'Notes').trim();

        const type = types.find((t) => t.name.toLowerCase() === typeName.toLowerCase());
        const rowDepositGiven = ['y', 'yes', 'true', '1'].includes(depositGivenRaw);

        if (!patientName || !phone || !type || Number.isNaN(token)) {
          failed++;
          return;
        }
        if (rowDepositGiven && !rowReceivedBy) {
          failed++;
          return;
        }
        const freeUnit = type.units.find((u) => u.status === 'free');
        if (!freeUnit) {
          failed++;
          return;
        }

        types = types.map((t) =>
          t.id !== type.id ? t : { ...t, units: t.units.map((u) => (u.id !== freeUnit.id ? u : { ...u, status: 'engaged' as const })) }
        );

        newAllocations.push({
          id: uid('alloc'),
          groupId: uid('grp'),
          unitId: freeUnit.id,
          typeId: type.id,
          patientName,
          patientPhone: phone,
          tokenAmount: token,
          depositGiven: rowDepositGiven,
          depositReceivedBy: rowDepositGiven ? rowReceivedBy : '',
          issueDate: rowIssueDate,
          expectedReturn: rowExpectedReturn,
          returnDate: '',
          status: 'active',
          notes: rowNotes
        });
        success++;
      });

      return { types, allocations: [...prev.allocations, ...newAllocations] };
    });

    if (success > 0) logActivity('Import issue records', `Imported ${success} issue record(s) from Excel`);
    return { success, failed };
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Issue Equipment</h2>
          <p className="sub">Give one or more equipment units to a patient against a refundable security deposit.</p>
        </div>
      </div>

      {data.types.length === 0 ? (
        <div className="empty">
          <div className="display">Add equipment first</div>
          <p>Go to the Dashboard to add equipment types before issuing them.</p>
        </div>
      ) : (
        <div className="panel">
          <ImportExportBar
            entityLabel="issue records"
            sampleFilename="issue-equipment-sample.xlsx"
            sampleHeaders={[
              'PatientName',
              'Phone',
              'EquipmentType',
              'TokenAmount',
              'IssueDate',
              'ExpectedReturn',
              'DepositGiven',
              'ReceivedBy',
              'Notes'
            ]}
            sampleRows={[
              ['Ramesh Patel', '9876543210', 'Wheelchair', 500, '2026-09-01', '2026-10-01', 'Yes', 'Amish Patel', 'Left leg injury'],
              ['Sita Devi', '9123456780', 'Walking Stick', 100, '2026-09-02', '', 'No', '', '']
            ]}
            onImportRows={handleImportIssues}
            exportFilenameBase="active-equipment-issues"
            exportTitle="Active Equipment Issues"
            exportHeaders={['Patient', 'Phone', 'Equipment', 'Unit', 'Token (₹)', 'Deposit', 'Issued', 'Expected Return']}
            getExportRows={() =>
              data.allocations
                .filter((a) => a.status === 'active')
                .map((a) => {
                  const t = typeById(data, a.typeId);
                  const u = unitById(data, a.unitId);
                  return [
                    a.patientName,
                    a.patientPhone,
                    t ? t.name : '—',
                    u ? u.unit.label : '—',
                    a.tokenAmount,
                    a.depositGiven ? 'Received' : 'Pending',
                    fmtDate(a.issueDate),
                    a.expectedReturn ? fmtDate(a.expectedReturn) : '—'
                  ];
                })
            }
          />
          <form onSubmit={handleSubmit}>
            <label style={{ marginBottom: 8 }}>Equipment to issue</label>
            {lines.map((line, i) => {
              const selectedType = data.types.find((t) => t.id === line.typeId);
              const availableUnits = availableUnitsForLine(line);
              return (
                <div
                  key={line.key}
                  className="field-row"
                  style={{ alignItems: 'flex-end', marginBottom: 10, paddingBottom: 10, borderBottom: i < lines.length - 1 ? '1px dashed var(--line)' : 'none' }}
                >
                  <div>
                    <label htmlFor={`issue-type-${line.key}`}>Equipment type</label>
                    <select
                      id={`issue-type-${line.key}`}
                      required
                      value={line.typeId}
                      onChange={(e) => handleLineTypeChange(line.key, e.target.value)}
                    >
                      <option value="">Select equipment…</option>
                      {data.types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({freeUnits(t).length} free)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`issue-unit-${line.key}`}>Unit to hand over</label>
                    <select
                      id={`issue-unit-${line.key}`}
                      required
                      value={line.unitId}
                      onChange={(e) => handleLineUnitChange(line.key, e.target.value)}
                      disabled={!selectedType}
                    >
                      {!selectedType ? (
                        <option value="">Select equipment type first</option>
                      ) : availableUnits.length === 0 ? (
                        <option value="">No free units — all engaged</option>
                      ) : (
                        availableUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`issue-token-${line.key}`}>Deposit (₹)</label>
                    <input
                      type="number"
                      id={`issue-token-${line.key}`}
                      min={0}
                      step={1}
                      required
                      value={line.tokenAmount}
                      onChange={(e) => handleLineTokenChange(line.key, e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '0 0 auto' }}>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => handleRemoveLine(line.key)}
                      disabled={lines.length === 1}
                      title={lines.length === 1 ? "Can't remove the only line" : 'Remove this item'}
                    >
                      Remove
                    </button>
                  </div>
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

            <div className="field-row">
              <div>
                <label htmlFor="issue-name">Patient name</label>
                <input type="text" id="issue-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="issue-phone">Contact number</label>
                <input
                  type="tel"
                  id="issue-phone"
                  placeholder="10-digit mobile"
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
                <label htmlFor="issue-date">Issue date</label>
                <input
                  type="date"
                  id="issue-date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="issue-return">Expected return date (optional)</label>
                <input
                  type="date"
                  id="issue-return"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(e.target.value)}
                />
              </div>
            </div>

            <div className="check-row">
              <input
                type="checkbox"
                id="issue-deposit-given"
                checked={depositGiven}
                onChange={(e) => handleDepositToggle(e.target.checked)}
              />
              <label htmlFor="issue-deposit-given">Deposit token has been received</label>
            </div>

            {depositGiven && (
              <div className="field-row">
                <div>
                  <label htmlFor="issue-received-by">Deposit received by</label>
                  <input
                    type="text"
                    id="issue-received-by"
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
                <label htmlFor="issue-notes">Notes (optional)</label>
                <textarea
                  id="issue-notes"
                  rows={2}
                  placeholder="Any remarks — condition of equipment, ID proof kept, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn">
              {lines.length > 1 ? `Issue ${lines.length} items` : 'Issue equipment'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
