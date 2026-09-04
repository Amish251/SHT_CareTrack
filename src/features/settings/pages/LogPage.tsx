import { useEffect, useMemo, useState } from 'react';
import { clearActivity, listActivity, type ActivityEntry } from '@/shared/lib/activityLog';
import { useToast } from '@/shared/components/ui/Toast';

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function LogPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  async function refresh() {
    setEntries(await listActivity());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.username} ${e.action} ${e.details}`.toLowerCase().includes(q));
  }, [entries, query]);

  async function handleClear() {
    if (!confirm('Clear the entire activity log? This cannot be undone.')) return;
    await clearActivity();
    setEntries([]);
    showToast('Activity log cleared.');
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Activity Log</h2>
          <p className="sub">Every recorded action across the app — visible only to the super admin.</p>
        </div>
        {entries.length > 0 && (
          <button type="button" className="btn small danger" onClick={handleClear}>
            Clear log
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search by user, action, details…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty">
          <div className="display">Loading…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="display">{entries.length === 0 ? 'Nothing logged yet' : 'No matches'}</div>
          <p>
            {entries.length === 0
              ? 'Actions across the app — issuing equipment, adding donations, managing users — will show up here as they happen.'
              : 'Try a different search.'}
          </p>
        </div>
      ) : (
        <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--slate)' }}>{fmtTimestamp(e.timestamp)}</td>
                  <td>
                    <strong>{e.username}</strong>
                  </td>
                  <td>
                    <span className={`pill ${e.role === 'staff' ? 'no' : 'yes'}`}>{e.role}</span>
                  </td>
                  <td>{e.action}</td>
                  <td style={{ color: 'var(--ink-soft)' }}>{e.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
