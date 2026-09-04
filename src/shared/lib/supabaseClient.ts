import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Fails loudly at startup rather than silently breaking every data call —
  // a missing env var is a deploy-config mistake, not a runtime edge case.
  throw new Error(
    'Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      '(see .env.example) — locally in a .env file, and in Vercel under Project Settings → Environment Variables.'
  );
}

// Preserves the app's existing "Remember Me" UX on top of Supabase Auth's
// session storage: auth.ts sets this flag right before signing in, and this
// adapter uses it to decide whether the session survives closing the tab
// (localStorage) or not (sessionStorage) — same behavior as before, now
// backed by a real server session instead of a hand-rolled one.
const REMEMBER_KEY = 'caretrack:remember-me';

const dualStorage = {
  getItem: (key: string) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key: string, value: string) => {
    const remember = localStorage.getItem(REMEMBER_KEY) !== 'false';
    if (remember) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: dualStorage
  }
});
