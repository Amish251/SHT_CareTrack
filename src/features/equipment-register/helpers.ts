import type { Allocation, EquipmentRegisterData, EquipmentType, EquipmentUnit } from './types';

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function typeById(data: EquipmentRegisterData, id: string): EquipmentType | undefined {
  return data.types.find((t) => t.id === id);
}

export function unitById(
  data: EquipmentRegisterData,
  unitId: string
): { unit: EquipmentUnit; type: EquipmentType } | undefined {
  for (const type of data.types) {
    const unit = type.units.find((u) => u.id === unitId);
    if (unit) return { unit, type };
  }
  return undefined;
}

export function freeUnits(type: EquipmentType): EquipmentUnit[] {
  return type.units.filter((u) => u.status === 'free');
}

export function engagedUnits(type: EquipmentType): EquipmentUnit[] {
  return type.units.filter((u) => u.status === 'engaged');
}

/** Stable grouping key — falls back to the allocation's own id for records
 *  saved before multi-item issuing existed (they don't have a groupId). */
export function groupKey(a: Allocation): string {
  return a.groupId || a.id;
}

/** All allocations issued together in the same visit, in a stable order. */
export function allocationsInGroup(data: EquipmentRegisterData, allocation: Allocation): Allocation[] {
  const key = groupKey(allocation);
  return data.allocations
    .filter((a) => groupKey(a) === key)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
