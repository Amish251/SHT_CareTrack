import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { initAuth, login as loginRequest, logout as logoutRequest, type Session } from '@/shared/lib/auth';
import { logActivity } from '@/shared/lib/activityLog';
import { useToast } from '@/shared/components/ui/Toast';

interface AuthContextValue {
  session: Session;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthGate');
  return ctx;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    (async () => {
      const s = await initAuth();
      setSession(s);
      setReady(true);
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const user = await loginRequest(username, password, remember);
    setBusy(false);
    if (!user) {
      setError('Incorrect username or password.');
      return;
    }
    setSession({ userId: user.id, username: user.username, role: user.role });
    logActivity('Sign in', `${user.username} signed in`);
  }

  function handleLogout() {
    logActivity('Sign out', `${session?.username || 'someone'} signed out`);
    logoutRequest();
    setSession(null);
  }

  function handleForgotPassword() {
    showToast('Ask your Trust admin to reset your password from Settings → Users.');
  }

  if (!ready) return null;

  if (!session) {
    return (
      <div className="login-screen">
        <img className="login-bg" src="/login-bg.svg" alt="" aria-hidden="true" />
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>CareTrack</h2>
          <p className="sub" style={{ marginBottom: 18 }}>Show Humanity Trust — sign in to continue</p>

          <div className="login-field">
            <label htmlFor="login-user">Username</label>
            <input
              id="login-user"
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="login-row">
            <label className="login-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember Me
            </label>
            <button type="button" className="login-link" onClick={handleForgotPassword}>
              Forgot Password
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>

          <p className="login-footer">Need access? Ask your Trust admin to add you in Settings → Users.</p>
        </form>
      </div>
    );
  }

  return <AuthContext.Provider value={{ session, logout: handleLogout }}>{children}</AuthContext.Provider>;
}
