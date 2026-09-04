import { supabase } from './supabaseClient';
import { getSession } from './auth';

export interface ActivityEntry {
  id: string;
  timestamp: string; // ISO
  username: string;
  role: string;
  action: string;
  details: string;
}

const MAX_ENTRIES = 1000;

/** Records one activity entry, tagged with whoever is currently signed in.
 *  Never throws — a logging failure should never break the action it's logging.
 *  Fire-and-forget: callers don't await this, so logging never adds latency
 *  to the action it's describing. */
export function logActivity(action: string, details: string): void {
  const session = getSession();
  supabase
    .from('activity_log')
    .insert({
      username: session?.username || 'system',
      role: session?.role || 'unknown',
      action,
      details
    })
    .then(({ error }) => {
      if (error) console.error('[caretrack] failed to log activity:', error);
    });
}

/** Only resolves with real data for the super admin — RLS returns an empty
 *  result (not an error) for everyone else, since the select policy on
 *  activity_log simply doesn't match their row. */
export async function listActivity(): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, created_at, username, role, action, details')
    .order('created_at', { ascending: false })
    .limit(MAX_ENTRIES);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    timestamp: row.created_at,
    username: row.username,
    role: row.role,
    action: row.action,
    details: row.details
  }));
}

export async function clearActivity(): Promise<void> {
  // RLS-scoped delete with no filter still only removes rows the caller's
  // policy allows — for anyone but the super admin that's zero rows.
  const { error } = await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}
