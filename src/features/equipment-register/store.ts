import { useNamespacedData } from '@/shared/lib/storage';
import type { EquipmentRegisterData } from './types';

const NAMESPACE = 'equipment-register';
const EMPTY: EquipmentRegisterData = { types: [], allocations: [] };

/** Live, shared equipment-register data — every device sees the same store. */
export function useEquipmentData() {
  return useNamespacedData<EquipmentRegisterData>(NAMESPACE, EMPTY);
}
