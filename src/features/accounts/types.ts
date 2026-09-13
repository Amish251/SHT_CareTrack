export type AccountEntryKind = 'credit' | 'debit';
export type AccountPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface AccountEntry {
  id: string;
  kind: AccountEntryKind;
  category: string;
  /** Only used when category === 'Other' — what the person actually typed to explain it.
   *  Shown in listings/exports/receipts as "Other — <categoryNote>" instead of bare "Other". */
  categoryNote: string;
  amount: number;
  partyName: string;
  partyPhone: string;
  date: string;
  paymentMode: AccountPaymentMode;
  handledBy: string;
  notes: string;
}

export interface AccountLedgerData {
  entries: AccountEntry[];
}

export const CREDIT_CATEGORIES = ['Donation', 'Grant', 'Event Collection', 'Transfer In', 'Other Income'];
export const DEBIT_CATEGORIES = ['Transport', 'Supplies', 'Event Expense', 'Maintenance', 'Transfer Out', 'Other Expense'];
export const ACCOUNT_PAYMENT_MODES: AccountPaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
