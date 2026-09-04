import type { FinanceData, FinanceEntry } from './types';

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
