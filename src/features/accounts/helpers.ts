import type { AccountConfig } from './config';
import type { AccountEntry, AccountLedgerData } from './types';

/**
 * The actual category values are "Other Income" (credit) and "Other Expense"
 * (debit) — NOT a bare "Other" — so every "is this the Other option" check
 * across the module must go through this helper instead of comparing to the
 * literal string 'Other' (which never matches and silently breaks the
 * "please specify" flow).
 */
export function isOtherCategory(category: string): boolean {
  return category === 'Other Income' || category === 'Other Expense';
}

/**
 * How a category should actually be shown — everywhere (listings, exports,
 * receipts): plain categories show as-is, but "Other Income"/"Other Expense"
 * show the person's own explanation instead of a bare, meaningless "Other".
 */
export function categoryDisplay(entry: Pick<AccountEntry, 'category' | 'categoryNote'>): string {
  if (isOtherCategory(entry.category) && entry.categoryNote.trim()) {
    return `${entry.category} — ${entry.categoryNote.trim()}`;
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

/**
 * Same idea as `accountReceiptNumber` but for debit (expense) entries, kept
 * as its own counter/series (SHT/<prefix>/EXP/0001) so paying out an expense
 * never shares — or collides with — a credit's receipt number.
 */
export function accountDebitReceiptNumber(data: AccountLedgerData, entry: AccountEntry, config: AccountConfig): string {
  const debits = data.entries.filter((e) => e.kind === 'debit').sort((a, b) => (a.id < b.id ? -1 : 1));
  const index = debits.findIndex((e) => e.id === entry.id);
  const ordinal = index === -1 ? debits.length + 1 : index + 1;
  return `SHT/${config.receiptPrefix}/EXP/${String(ordinal).padStart(4, '0')}`;
}
