export interface AccountConfig {
  /** Supabase app_data namespace — must match a namespace with RLS policies in supabase/schema.sql. */
  namespace: string;
  /** Route base, e.g. 'ambaji-account' → /ambaji-account, /ambaji-account/add, /ambaji-account/records */
  slug: string;
  /** Display name shown throughout the UI. */
  title: string;
  /** Short sidebar tag, matching the style of other modules (ER, DN, ST). */
  tag: string;
}

export const ACCOUNTS: Record<'ambaji' | 'seoc', AccountConfig> = {
  ambaji: { namespace: 'ambaji-account', slug: 'ambaji-account', title: 'Ambaji Account', tag: 'AM' },
  seoc: { namespace: 'seoc-account', slug: 'seoc-account', title: 'SEOC Account', tag: 'SO' }
};
