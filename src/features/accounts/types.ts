export type AccountEntryKind = 'credit' | 'debit';
export type AccountPaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface AccountEntry {
  id: string;
  kind: AccountEntryKind;
  /** Freeform — what this credit or debit is actually for, typed by the person recording it. */
  category: string;
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

export const ACCOUNT_PAYMENT_MODES: AccountPaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
