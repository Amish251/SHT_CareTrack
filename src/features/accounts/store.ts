import { useNamespacedData } from '@/shared/lib/storage';
import type { AccountLedgerData } from './types';

const EMPTY: AccountLedgerData = { entries: [] };

/**
 * Live, shared credit/debit data for one named account (e.g. "ambaji-account").
 * Each account is its own Supabase row/namespace, so Ambaji and SEOC data
 * never mix — access level (admin/superadmin only) is enforced by RLS in
 * supabase/schema.sql, same pattern as `finance`.
 */
export function useAccountData(namespace: string) {
  return useNamespacedData<AccountLedgerData>(namespace, EMPTY);
}
