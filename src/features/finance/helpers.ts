import type { FinanceData, FinanceEntry } from './types';

/** True for the literal "Other" category value used by both DONATION_CATEGORIES and EXPENSE_CATEGORIES. */
export function isOtherCategory(category: string): boolean {
  return category === 'Other';
}

/**
 * How a category should actually be shown — everywhere (listings, exports,
 * receipts): plain categories show as-is, but "Other" shows the person's own
 * explanation instead of a bare, meaningless "Other". Mirrors
 * `categoryDisplay` in the accounts module, for consistency between Donation
 * and the Ambaji/SEOC ledgers.
 */
export function categoryDisplay(entry: Pick<FinanceEntry, 'category' | 'categoryNote'>): string {
  if (isOtherCategory(entry.category) && entry.categoryNote.trim()) {
    return `Other — ${entry.categoryNote.trim()}`;
  }
  return entry.category;
}

/**
 * A stable, human-friendly receipt number for a donation — its 1-based
 * position among all donations ever recorded, ordered by id (ids are
 * timestamp-based via uid(), so this is creation order). Old entries keep
 * the same number as new ones are added after them; it only shifts if an
 * earlier donation is deleted, which is an acceptable trade-off for a
 * receipt number that needs no separate counter to maintain.
 */
export function donationReceiptNumber(data: FinanceData, entry: FinanceEntry): string {
  const donations = data.entries.filter((e) => e.kind === 'donation').sort((a, b) => (a.id < b.id ? -1 : 1));
  const index = donations.findIndex((e) => e.id === entry.id);
  const ordinal = index === -1 ? donations.length + 1 : index + 1;
  return `SHT/DON/${String(ordinal).padStart(4, '0')}`;
}

/** Same idea as `donationReceiptNumber` but for expenses, kept as its own series (SHT/EXP/0001). */
export function expenseReceiptNumber(data: FinanceData, entry: FinanceEntry): string {
  const expenses = data.entries.filter((e) => e.kind === 'expense').sort((a, b) => (a.id < b.id ? -1 : 1));
  const index = expenses.findIndex((e) => e.id === entry.id);
  const ordinal = index === -1 ? expenses.length + 1 : index + 1;
  return `SHT/EXP/${String(ordinal).padStart(4, '0')}`;
}
