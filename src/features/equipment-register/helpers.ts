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

/** "Wheelchair (WC-1)" — human label for a type + unit pair, used in toasts and the activity log. */
export function describeUnit(data: EquipmentRegisterData, typeId: string, unitId: string): string {
  const type = data.types.find((t) => t.id === typeId);
  const unit = type?.units.find((u) => u.id === unitId);
  return `${type ? type.name : 'Equipment'}${unit ? ` (${unit.label})` : ''}`;
}

export type VisitStatus = 'active' | 'returned' | 'partial';

/** One patient visit = every allocation issued together (same groupId). */
export interface Visit {
  key: string;
  /** Every item in the visit, in stable order. */
  items: Allocation[];
  active: Allocation[];
  returned: Allocation[];
  /** First item — supplies the shared patient details. */
  primary: Allocation;
  totalToken: number;
  status: VisitStatus;
  latestReturnDate: string;
}

/** Collapse allocations into one entry per visit. Pass a pre-filtered list to group only those items. */
export function buildVisits(allocations: Allocation[]): Visit[] {
  const map = new Map<string, Allocation[]>();
  for (const a of allocations) {
    const key = groupKey(a);
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }
  return [...map.entries()].map(([key, list]) => {
    const items = list.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const active = items.filter((a) => a.status === 'active');
    const returned = items.filter((a) => a.status === 'returned');
    return {
      key,
      items,
      active,
      returned,
      primary: items[0],
      totalToken: items.reduce((s, a) => s + a.tokenAmount, 0),
      status: (returned.length === 0 ? 'active' : active.length === 0 ? 'returned' : 'partial') as VisitStatus,
      latestReturnDate: returned.reduce((m, a) => (a.returnDate > m ? a.returnDate : m), '')
    };
  });
}

/** Mark the given active allocations as returned and free their units. */
export function applyReturn(
  prev: EquipmentRegisterData,
  ids: Set<string>,
  returnDate: string
): EquipmentRegisterData {
  const releasing = prev.allocations.filter((a) => ids.has(a.id) && a.status === 'active');
  const unitIds = new Set(releasing.map((a) => a.unitId));
  return {
    types: prev.types.map((t) => ({
      ...t,
      units: t.units.map((u) => (unitIds.has(u.id) ? { ...u, status: 'free' as const } : u))
    })),
    allocations: prev.allocations.map((a) =>
      ids.has(a.id) && a.status === 'active' ? { ...a, status: 'returned' as const, returnDate } : a
    )
  };
}

/** Delete the given allocations; units held by still-active ones are freed. */
export function applyDelete(prev: EquipmentRegisterData, ids: Set<string>): EquipmentRegisterData {
  const unitIds = new Set(prev.allocations.filter((a) => ids.has(a.id) && a.status === 'active').map((a) => a.unitId));
  return {
    types: prev.types.map((t) => ({
      ...t,
      units: t.units.map((u) => (unitIds.has(u.id) ? { ...u, status: 'free' as const } : u))
    })),
    allocations: prev.allocations.filter((a) => !ids.has(a.id))
  };
}

/** Ask for a return date. Blank = today. Returns null if cancelled or the date is invalid. */
export function promptReturnDate(): string | null {
  const raw = window.prompt('Return date (YYYY-MM-DD)?', todayStr());
  if (raw === null) return null;
  const value = raw.trim() || todayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value + 'T00:00:00').getTime())) {
    window.alert('Please enter the date as YYYY-MM-DD, e.g. 2026-10-09.');
    return null;
  }
  return value;
}
