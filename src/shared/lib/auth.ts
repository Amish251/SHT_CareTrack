import { supabase } from './supabaseClient';

export type UserRole = 'admin' | 'staff' | 'superadmin';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface Session {
  userId: string;
  username: string;
  role: UserRole;
}

// Must match EMAIL_DOMAIN in supabase/functions/manage-user/index.ts — usernames
// aren't real emails, so every login gets a synthetic one under this fixed domain.
// Supabase Auth is email-based; this lets the app keep its plain-username logins
// without asking anyone at the Trust to remember or type an email address.
const EMAIL_DOMAIN = 'caretrack.internal';

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

// A quick, synchronous-feeling cache of the resolved session (Supabase user +
// our own profiles row) so callers like activityLog.ts don't need to await a
// network round trip just to know who's signed in. Populated by initAuth() on
// app start and kept current by login()/logout() — see the note in
// DEPLOYMENT_PLAN.md about why this app doesn't run a background
// onAuthStateChange listener on top of this.
let cachedSession: Session | null = null;

async function resolveSession(userId: string | undefined): Promise<Session | null> {
  if (!userId) return null;
  const { data: profile, error } = await supabase.from('profiles').select('username, role').eq('id', userId).single();
  if (error || !profile) return null;
  return { userId, username: profile.username, role: profile.role as UserRole };
}

/** Call once, on app start, before rendering anything that depends on auth state. */
export async function initAuth(): Promise<Session | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  cachedSession = await resolveSession(session?.user.id);
  return cachedSession;
}

/**
 * `remember`: true (default) keeps the session past closing the browser/tab.
 * false clears it as soon as the tab/browser closes — for a shared or public
 * device where "Remember Me" was left unchecked. Implemented by the custom
 * storage adapter in supabaseClient.ts; this just sets the flag it reads.
 */
export async function login(username: string, password: string, remember = true): Promise<AuthUser | null> {
  localStorage.setItem('caretrack:remember-me', remember ? 'true' : 'false');
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  const session = await resolveSession(data.user.id);
  if (!session) return null;
  cachedSession = session;
  return { id: session.userId, username: session.username, role: session.role };
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  cachedSession = null;
}

/** Synchronous, cached — safe to call from anywhere once initAuth() has resolved. */
export function getSession(): Session | null {
  return cachedSession;
}

/** Every user account visible to the caller. RLS on `profiles` already hides
 *  the super admin's row from everyone except the super admin themselves —
 *  this is the actual enforcement, not just a UI filter, so there's no
 *  separate "visible vs all" split to maintain client-side anymore. */
export async function listUsers(): Promise<AuthUser[]> {
  const { data, error } = await supabase.from('profiles').select('id, username, role').order('username');
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, username: r.username, role: r.role as UserRole }));
}

/** Kept as an alias so existing call sites don't need to change — see the
 *  comment on listUsers() for why "visible" and "all" are now the same query. */
export const listVisibleUsers = listUsers;

export async function addUser(
  username: string,
  password: string,
  role: 'admin' | 'staff'
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = username.trim();
  if (!trimmed || !password) return { ok: false, error: 'Username and password are required.' };
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'create', username: trimmed, password, role }
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

/** Refuses to delete a super admin account, regardless of who's asking — enforced
 *  again inside the Edge Function itself, not just here. */
export async function deleteUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'delete', userId }
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

/** Admin-resets someone else's password (they don't need to know their old one) —
 *  the Settings → Users equivalent of the login page's "ask your Trust admin". */
export async function resetUserPassword(userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'reset-password', userId, newPassword }
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

/** Changes the *signed-in* user's own password — no special privilege needed,
 *  Supabase allows a user to update their own password directly. */
export async function changePassword(_userId: string, newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Confirms the current password by re-authenticating with it — used before
 *  letting someone set a new password from their own profile. Re-signing-in
 *  as yourself just refreshes the session; it doesn't break anything. */
export async function verifyPassword(_userId: string, password: string): Promise<boolean> {
  if (!cachedSession) return false;
  const email = usernameToEmail(cachedSession.username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}
