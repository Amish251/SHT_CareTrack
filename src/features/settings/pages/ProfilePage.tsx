import { useState, type FormEvent } from 'react';
import { useAuth } from '@/shared/components/AuthGate';
import { changePassword, verifyPassword } from '@/shared/lib/auth';
import { useToast } from '@/shared/components/ui/Toast';
import { UserCircle2 } from 'lucide-react';

export default function ProfilePage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('New password should be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    const ok = await verifyPassword(session.userId, currentPassword);
    if (!ok) {
      setBusy(false);
      setError('Current password is incorrect.');
      return;
    }

    await changePassword(session.userId, newPassword);
    setBusy(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Password updated.');
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-head-icon-row">
          <div className="icon-badge">
            <UserCircle2 />
          </div>
          <div>
          <h2>My Login</h2>
          <p className="sub">
            Signed in as <strong>{session.username}</strong> ({session.role}). Change your own password here —
            an admin can also reset it from Settings → Users if you get locked out.
          </p>
        </div>
      </div>
      </div>

      <div className="panel" style={{ maxWidth: 420 }}>
        <h3>Change password</h3>
        <form onSubmit={handleSubmit}>
          <label htmlFor="profile-current">Current password</label>
          <input
            id="profile-current"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <label htmlFor="profile-new">New password</label>
          <input
            id="profile-new"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <label htmlFor="profile-confirm">Confirm new password</label>
          <input
            id="profile-confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

          <div style={{ marginTop: 16 }}>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
