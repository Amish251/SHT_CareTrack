export type FinanceKind = 'donation' | 'expense';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface FinanceEntry {
  id: string;
  kind: FinanceKind;
  category: string;
  /** Only used when category === 'Other' — what the person actually typed to explain it.
   *  Shown in listings/exports/receipts as "Other — <categoryNote>" instead of bare "Other". */
  categoryNote: string;
  amount: number;
  partyName: string;
  partyPhone: string;
  date: string;
  paymentMode: PaymentMode;
  receivedBy: string;
  notes: string;
}

export interface FinanceData {
  entries: FinanceEntry[];
}

export const DONATION_CATEGORIES = ['General Donation', 'Equipment Sponsorship', 'Event Sponsorship', 'Other'];
export const EXPENSE_CATEGORIES = ['Transport', 'New Equipment Purchase', 'Maintenance / Repair', 'Office / Admin', 'Other'];
export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
