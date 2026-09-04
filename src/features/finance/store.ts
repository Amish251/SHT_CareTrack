import { useNamespacedData } from '@/shared/lib/storage';
import type { FinanceData } from './types';

const NAMESPACE = 'finance';
const EMPTY: FinanceData = { entries: [] };

/** Live, shared donation/expense data — admin and super admin only (enforced by RLS). */
export function useFinanceData() {
  return useNamespacedData<FinanceData>(NAMESPACE, EMPTY);
}
