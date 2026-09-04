// supabase/functions/manage-user/index.ts
//
// Deploy with: supabase functions deploy manage-user
// Called from the browser via supabase.functions.invoke('manage-user', ...) —
// the browser only ever holds the anon key, never SUPABASE_SERVICE_ROLE_KEY.
// This function is the one place that key is used, and it never leaves the
// server (Supabase sets it automatically as a secret for every Edge Function
// — you do not paste it in anywhere yourself).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EMAIL_DOMAIN = 'caretrack.internal';
const ALLOWED_ROLES = ['staff', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Client scoped to the caller's own JWT — used only to find out who's
  // asking and what their role is, respecting normal RLS.
  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const {
    data: { user: caller }
  } = await callerClient.auth.getUser();
  if (!caller) return json({ ok: false, error: 'Not signed in.' }, 401);

  const { data: callerProfile } = await callerClient.from('profiles').select('role').eq('id', caller.id).single();
  const callerRole = callerProfile?.role;
  if (callerRole !== 'admin' && callerRole !== 'superadmin') {
    return json({ ok: false, error: 'Only admins can manage users.' }, 403);
  }

  // Elevated client — service role, bypasses RLS. Only used for the exact
  // operations below, never to satisfy an arbitrary client-supplied query.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === 'create') {
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const role = body.role as AllowedRole;

    if (!username || !password) return json({ ok: false, error: 'Username and password are required.' }, 400);
    if (!ALLOWED_ROLES.includes(role)) {
      return json({ ok: false, error: 'Role must be staff or admin — the super admin account is created manually, once, during setup.' }, 400);
    }

    const email = usernameToEmail(username);
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createErr || !created.user) {
      const msg = createErr?.message.includes('already been registered')
        ? 'That username already exists.'
        : createErr?.message || 'Could not create the login.';
      return json({ ok: false, error: msg }, 400);
    }

    const { error: profileErr } = await adminClient
      .from('profiles')
      .insert({ id: created.user.id, username, role });
    if (profileErr) {
      // Roll back the auth user so we don't leave an orphaned login with no profile.
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ ok: false, error: profileErr.message }, 400);
    }

    return json({ ok: true, userId: created.user.id });
  }

  if (action === 'delete') {
    const userId = String(body.userId || '');
    if (!userId) return json({ ok: false, error: 'Missing userId.' }, 400);
    if (userId === caller.id) return json({ ok: false, error: "You can't remove your own account while signed in." }, 400);

    const { data: target } = await adminClient.from('profiles').select('role').eq('id', userId).single();
    if (!target) return json({ ok: false, error: 'User not found.' }, 404);
    if (target.role === 'superadmin') {
      return json({ ok: false, error: "The super admin account can't be deleted." }, 403);
    }

    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true });
  }

  if (action === 'reset-password') {
    const userId = String(body.userId || '');
    const newPassword = String(body.newPassword || '');
    if (!userId || !newPassword) return json({ ok: false, error: 'Missing userId or newPassword.' }, 400);

    const { data: target } = await adminClient.from('profiles').select('role').eq('id', userId).single();
    if (!target) return json({ ok: false, error: 'User not found.' }, 404);
    if (target.role === 'superadmin' && callerRole !== 'superadmin') {
      return json({ ok: false, error: "Only the super admin can reset the super admin's password." }, 403);
    }

    const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ ok: false, error: `Unknown action "${action}".` }, 400);
});
