export type UnitStatus = 'free' | 'engaged';

export interface EquipmentUnit {
  id: string;
  label: string;
  status: UnitStatus;
}

export interface EquipmentType {
  id: string;
  name: string;
  tokenAmount: number;
  units: EquipmentUnit[];
}

export type AllocationStatus = 'active' | 'returned';

export interface Allocation {
  id: string;
  groupId: string;
  unitId: string;
  typeId: string;
  patientName: string;
  patientPhone: string;
  tokenAmount: number;
  depositGiven: boolean;
  depositReceivedBy: string;
  issueDate: string;
  expectedReturn: string;
  returnDate: string;
  status: AllocationStatus;
  notes: string;
}

export interface EquipmentRegisterData {
  types: EquipmentType[];
  allocations: Allocation[];
}
