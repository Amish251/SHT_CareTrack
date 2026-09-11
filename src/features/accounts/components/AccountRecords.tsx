import { useMemo, useState } from 'react';
import { useAccountData } from '../store';
import type { AccountEntryKind } from '../types';
import type { AccountConfig } from '../config';
import { fmtDate } from '@/features/equipment-register/helpers';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';

export default function AccountRecords({ config }: { config: AccountConfig }) {
  const [data, update] = useAccountData(config.namespace);
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'' | AccountEntryKind>('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.entries
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((e) => {
        if (kindFilter && e.kind !== kindFilter) return false;
        if (q) {
          const hay = `${e.partyName} ${e.category} ${e.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [data.entries, query, kindFilter]);

  function handleDelete(id: string) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const entry = data.entries.find((e) => e.id === id);
    update((prev) => ({ entries: prev.entries.filter((e) => e.id !== id) }));
    if (entry) {
      logActivity(
        entry.kind === 'credit' ? `Delete ${config.title} credit` : `Delete ${config.title} debit`,
        `Deleted ${entry.kind} of ₹${entry.amount}${entry.partyName ? ` — ${entry.partyName}` : ''}`
      );
    }
    showToast('Entry deleted.');
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>{config.title} — All Records</h2>
          <p className="sub">Every credit and debit entry recorded for {config.title}.</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search category, party, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as '' | AccountEntryKind)}>
          <option value="">All types</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
      </div>

      <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Party</th>
              <th>Amount</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--slate)', padding: 30 }}>
                  No records match.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    <span className={`pill ${e.kind === 'credit' ? 'yes' : 'no'}`}>
                      {e.kind === 'credit' ? 'Credit' : 'Debit'}
                    </span>
                  </td>
                  <td>{e.category}</td>
                  <td>
                    {e.partyName || '—'}
                    {e.partyPhone && <div style={{ fontSize: 11, color: 'var(--slate)' }}>{e.partyPhone}</div>}
                  </td>
                  <td className="mono">₹{e.amount.toLocaleString('en-IN')}</td>
                  <td style={{ maxWidth: 220, color: 'var(--slate)', fontSize: 12 }}>{e.notes || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn small danger" onClick={() => handleDelete(e.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
