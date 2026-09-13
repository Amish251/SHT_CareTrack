import type { AccountConfig } from './config';
import type { AccountEntry, AccountLedgerData } from './types';

/**
 * How a category should actually be shown — everywhere (listings, exports,
 * receipts): plain categories show as-is, but "Other" shows the person's own
 * explanation instead of a bare, meaningless "Other".
 */
export function categoryDisplay(entry: Pick<AccountEntry, 'category' | 'categoryNote'>): string {
  if (entry.category === 'Other' && entry.categoryNote.trim()) {
    return `Other — ${entry.categoryNote.trim()}`;
  }
  return entry.category;
}

/**
 * A stable, human-friendly receipt number for a credit entry — its 1-based
 * position among all credits recorded for THIS account, ordered by id
 * (ids are timestamp-based via uid(), so this is creation order). Mirrors
 * `donationReceiptNumber` in the finance module, but scoped per account and
 * using that account's own prefix so Ambaji and SEOC numbering never overlap.
 */
export function accountReceiptNumber(data: AccountLedgerData, entry: AccountEntry, config: AccountConfig): string {
  const credits = data.entries.filter((e) => e.kind === 'credit').sort((a, b) => (a.id < b.id ? -1 : 1));
  const index = credits.findIndex((e) => e.id === entry.id);
  const ordinal = index === -1 ? credits.length + 1 : index + 1;
  return `SHT/${config.receiptPrefix}/${String(ordinal).padStart(4, '0')}`;
}
