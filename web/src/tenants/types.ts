// Types for the Tenants list page. The app itself is plain JSX; these document the shapes the components pass around.
// Row shape matches GET /api/tenants.
export type TenantStatus = 'applicant' | 'active' | 'pending_in' | 'pending_out' | 'past';
export type TenantRole = 'primary' | 'co_tenant' | 'occupant';

export interface TenantRow {
  id: string;
  first: string;
  last: string;
  email: string | null;
  phone: string | null;
  photo: string | null;
  status: TenantStatus;
  moveIn: string | null; // YYYY-MM-DD
  leaseId: string | null;
  role: TenantRole | null;
  unitId: string | null;
  unitNumber: string | null;
  propertyId: string | null;
  propertyName: string | null;
  rent: number | null; // cents
  balance: number; // cents, whole household
}

export type FieldType = 'text' | 'enum' | 'number' | 'money' | 'date';
export type FieldGroup = 'Tenant Fields' | 'Property Fields';

export interface ColumnDef {
  key: string;
  label: string;
  group: FieldGroup;
  type: FieldType;
  width: number;
  options?: [value: string, label: string][]; // for enum fields
  value: (row: TenantRow) => string | number | null; // raw value used for sort and filter
  alwaysVisible?: boolean; // Name cannot be hidden
}

export interface ColumnState {
  key: string;
  width: number;
  pin: 'left' | 'right' | null;
  visible: boolean;
}

export type Operator =
  | 'is' | 'is_not' | 'contains' | 'not_contains' | 'empty' | 'not_empty'
  | 'eq' | 'gt' | 'lt' | 'between'
  | 'before' | 'after';

export interface Filter {
  id: string;
  field: string;
  op: Operator;
  value: string;
  value2?: string; // upper bound for "between"
}

export interface SavedSearch { id: string; name: string; filters: Filter[] }
export interface SortState { key: string; dir: 'asc' | 'desc' }
export type ViewKey = 'all' | TenantStatus;
