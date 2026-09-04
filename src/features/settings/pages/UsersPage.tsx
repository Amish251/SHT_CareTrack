import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/shared/components/AuthGate';
import { addUser, deleteUser, listVisibleUsers, resetUserPassword, type AuthUser, type UserRole } from '@/shared/lib/auth';
import { useToast } from '@/shared/components/ui/Toast';
import { logActivity } from '@/shared/lib/activityLog';

export default function UsersPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  async function refresh() {
    setUsers(await listVisibleUsers());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (session.role !== 'admin' && session.role !== 'superadmin') {
    return (
      <div className="empty">
        <div className="display">Admins only</div>
        <p>Ask an admin user to manage logins for you.</p>
      </div>
    );
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError('');
    const result = await addUser(username, password, role);
    if (!result.ok) {
      setError(result.error || 'Could not add user.');
      return;
    }
    logActivity('Add user', `Added "${username.trim()}" as ${role}`);
    setUsername('');
    setPassword('');
    setRole('staff');
    await refresh();
    showToast('User added.');
  }

  async function handleDelete(user: AuthUser) {
    if (user.id === session.userId) {
      showToast("You can't remove your own account while signed in.");
      return;
    }
    if (!confirm(`Remove login access for "${user.username}"?`)) return;
    const result = await deleteUser(user.id);
    if (!result.ok) {
      showToast(result.error || "Couldn't remove that user.");
      return;
    }
    logActivity('Remove user', `Removed "${user.username}" (${user.role})`);
    await refresh();
    showToast('User removed.');
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    const result = await resetUserPassword(resetTarget.id, resetPassword);
    if (!result.ok) {
      showToast(result.error || "Couldn't reset that password.");
      return;
    }
    logActivity('Reset password', `Reset password for "${resetTarget.username}"`);
    showToast(`Password reset for ${resetTarget.username}.`);
    setResetTarget(null);
    setResetPassword('');
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p className="sub">Everyone who can sign in to this app, with their own login.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Add a user</h3>
        <form onSubmit={handleAdd}>
          <div className="field-row">
            <div>
              <label htmlFor="user-name">Username</label>
              <input type="text" id="user-name" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label htmlFor="user-pass">Password</label>
              <input type="password" id="user-pass" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label htmlFor="user-role">Role</label>
              <select id="user-role" value={role} onChange={(e) => setRole(e.target.value as UserRole as 'admin' | 'staff')}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {error && <div className="login-error" style={{ marginBottom: 14 }}>{error}</div>}
          <button type="submit" className="btn">
            Add user
          </button>
        </form>
      </div>

      {resetTarget && (
        <div className="panel" style={{ background: 'rgba(31,111,178,0.05)' }}>
          <h3>Reset password for {resetTarget.username}</h3>
          <form onSubmit={handleResetSubmit}>
            <div className="field-row">
              <div>
                <label htmlFor="reset-pass">New password</label>
                <input
                  type="password"
                  id="reset-pass"
                  required
                  autoFocus
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn">
                Set new password
              </button>
              <button
                type="button"
                className="btn small secondary"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel table-wrap" style={{ padding: '8px 16px' }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--slate)', padding: 30 }}>
                  Loading…
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.username}</strong>
                    {u.id === session.userId && <span style={{ color: 'var(--slate)', fontSize: 11 }}> (you)</span>}
                  </td>
                  <td>
                    <span className={`pill ${u.role === 'admin' ? 'active' : 'returned'}`}>{u.role}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => {
                          setResetTarget(u);
                          setResetPassword('');
                        }}
                      >
                        Reset password
                      </button>
                      <button type="button" className="btn small danger" onClick={() => handleDelete(u)}>
                        Remove
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
