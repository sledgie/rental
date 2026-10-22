export type PropertyType = 'Multi-Family Residential' | 'Mixed-Use High-Rise' | 'Boutique Lofts' | 'Urban Townhomes';

export interface Property {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  propertyType: PropertyType;
  ownerId: string;
  ownerName: string;
  totalUnits: number;
  rentableUnits: number;
  yearBuilt: number;
  assignedManager: string;
  activeStatus: boolean;
}

export type UnitType = 'Studio' | '1 Bedroom' | '1 Bedroom + Den' | '2 Bedroom' | '2 Bedroom + Den' | '3 Bedroom' | 'Penthouse';

export type CurrentOccupancyStatus =
  | 'Occupied'
  | 'Vacant — Ready'
  | 'Vacant — Needs Cleaning'
  | 'Vacant — Under Maintenance'
  | 'Vacant — Under Renovation'
  | 'Reserved'
  | 'Leased — Awaiting Move-In'
  | 'Unavailable';

export type ReadinessStatus =
  | 'Inspection Pending'
  | 'Inspection Complete'
  | 'Cleaning Required'
  | 'Maintenance Required'
  | 'Renovation Required'
  | 'Ready for Leasing'
  | 'Leased — Awaiting Move-In'
  | 'Completed';

export interface Unit {
  unitId: string;
  propertyId: string;
  unitNumber: string;
  floor: number;
  unitType: UnitType;
  rentableAreaSqFt: number;
  marketRent: number;
  contractualRent: number | null;
  askingRent: number;
  isRentable: boolean; // if false, unavailable/administrative
  readinessStatus: ReadinessStatus;
  currentOccupancyStatus: CurrentOccupancyStatus;
  vacancyStartDate: string | null; // ISO YYYY-MM-DD
  expectedAvailableDate: string | null;
  nextScheduledMoveInDate: string | null;
  assignedLeasingAgent: string | null;
  notes?: string;
}

export type RenewalStatus =
  | 'Not Contacted'
  | 'Renewal Discussion'
  | 'Renewal Offered'
  | 'Awaiting Tenant Response'
  | 'Renewed'
  | 'Tenant Moving Out'
  | 'Expired'
  | 'Month-to-Month';

export type TenancyStatus = 'Active' | 'Notice Given' | 'Month-to-Month' | 'Pending Move-In' | 'Terminated' | 'Expired';

export interface Lease {
  leaseId: string;
  leaseNumber: string;
  propertyId: string;
  tenantId: string;
  unitIds: string[]; // Supports multi-unit leases
  leaseStartDate: string;
  leaseEndDate: string; // empty or null if month-to-month
  monthlyRent: number;
  marketRentAtSign: number;
  depositAmount: number;
  depositStatus: 'Held in Escrow' | 'Partially Applied' | 'Refunded' | 'Pending Collection';
  tenancyStatus: TenancyStatus;
  renewalStatus: RenewalStatus;
  noticeStatus: 'None' | 'Notice to Vacate Received' | 'Non-Renewal Notice Sent' | 'Eviction Notice';
  proposedRenewalRent?: number;
  expectedMoveOutDate?: string | null;
  assignedPropertyManager: string;
  isMultiUnit?: boolean;
}

export interface Tenant {
  tenantId: string;
  tenantName: string;
  email: string;
  phone: string;
  tenantStatus: 'Current' | 'Notice Period' | 'Prospective' | 'Former';
  moveInDate: string;
  moveOutDate: string | null;
}

export interface HistoricalOccupancyRecord {
  period: string; // '2026-10', '2026-09', etc.
  periodLabel: string; // 'Oct 2026'
  propertyId: string;
  propertyName: string;
  totalRentableUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  reservedUnits: number;
  unavailableUnits: number;
  occupancyRate: number; // percentage
  vacancyRate: number;
  moveIns: number;
  moveOuts: number;
}

export interface UnitReadinessRecord {
  readinessRecordId: string;
  propertyId: string;
  unitId: string;
  unitNumber: string;
  previousTenantName: string;
  moveOutDate: string;
  inspectionStatus: 'Pending' | 'In Progress' | 'Complete';
  cleaningStatus: 'Required' | 'In Progress' | 'Complete';
  maintenanceStatus: 'Required' | 'In Progress' | 'Complete' | 'Not Required';
  renovationStatus: 'Required' | 'In Progress' | 'Complete' | 'Not Applicable';
  readyForRentDate: string | null;
  nextTenantName: string | null;
  nextMoveInDate: string | null;
  daysToReady: number | null;
  totalTurnoverDays: number | null;
  estimatedCost: number;
}

export interface LeasingPipelineFunnel {
  period: string;
  inquiries: number;
  applicationsReceived: number;
  applicationsApproved: number;
  applicationsDeclined: number;
  leasesOffered: number;
  leasesSigned: number;
  scheduledMoveIns: number;
  completedMoveIns: number;
  avgTimeToLeaseDays: number;
  assignedAgent?: string;
  propertyId?: string;
}

export interface MoveRecord {
  movementId: string;
  tenantName: string;
  tenantId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  unitId: string;
  leaseNumber: string;
  movementType: 'Move-In' | 'Move-Out' | 'Transfer Between Units' | 'Transfer Between Properties';
  scheduledDate: string;
  actualDate: string | null;
  previousUnitStatus: string;
  newUnitStatus: string;
  turnoverReference: string;
  isInterPortfolioTransfer?: boolean;
}

export interface OccupancyException {
  exceptionId: string;
  exceptionType:
    | 'Occupied with No Active Lease'
    | 'Conflicting Overlapping Leases'
    | 'Vacant with Current Occupancy Record'
    | 'Unavailable Unit in Rentable Pool'
    | 'Move-Out Precedes Move-In'
    | 'Expired Lease Without Tenancy Review'
    | 'Leased Status Missing Move-In Record'
    | 'Missing Rent Amount'
    | 'Multi-Unit Unit Count Discrepancy';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  unitId?: string;
  leaseNumber?: string;
  description: string;
  recommendedAction: string;
  status: 'Open' | 'Under Review' | 'Resolved';
  detectedDate: string;
}

export interface ReportFilterState {
  asOfDate: string; // YYYY-MM-DD
  dateRange: {
    startDate: string;
    endDate: string;
  };
  periodPreset: 'today' | '30days' | '60days' | '90days' | 'currentMonth' | 'lastMonth' | 'q3-2026' | 'q4-2026' | 'ytd-2026' | 'last12months' | 'custom';
  propertyId: string; // 'all' or specific id
  unitType: string; // 'all' or specific
  occupancyStatus: string; // 'all' or specific
  readinessStatus: string; // 'all' or specific
  searchQuery: string;
  thresholdDays: number; // For long-term vacancy: 30, 60, 90
  expiryWindowDays: number; // For expiration: 30, 60, 90, 180
}

export type ReportCategory =
  | 'all'
  | 'core'
  | 'operational'
  | 'financial'
  | 'pipeline'
  | 'data-quality';

export interface ReportMetadata {
  id: string;
  number: number;
  title: string;
  category: ReportCategory;
  categoryLabel: string;
  description: string;
  keyOutputs: string[];
  isPrimaryScope: boolean;
  requiresDataNotice?: string;
  defaultPeriodType: 'snapshot' | 'range' | 'trend';
}
