export type FinanceKind = 'donation' | 'expense';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export interface FinanceEntry {
  id: string;
  kind: FinanceKind;
  /** Freeform — what this donation or expense is actually for, typed by the person recording it. */
  category: string;
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

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
