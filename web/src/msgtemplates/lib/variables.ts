export type VariableDefinition = { name: string; group: string; description: string; type: string; example: string };

const define = (group: string, entries: [string, string, string, string][]): VariableDefinition[] =>
  entries.map(([name, description, type, example]) => ({ name, group, description, type, example }));

export const VARIABLE_GROUPS = [
  ...define("Company", [
    ["company_name", "Legal or operating name of the management company", "Text", "Northbridge Residential"],
    ["company_email", "Primary company support email", "Email", "support@northbridge.example"],
    ["company_phone", "Primary company phone number", "Phone", "+1 416 555 0138"],
    ["company_address", "Company mailing address", "Text", "80 King Street West, Toronto, ON"],
    ["portal_url", "Secure tenant or owner portal URL", "URL", "https://portal.northbridge.example"],
  ]),
  ...define("Property", [
    ["property_name", "Name of the related property", "Text", "The Sutherland"],
    ["property_address", "Full property street address", "Text", "218 Sutherland Avenue, Toronto, ON"],
    ["property_manager_name", "Assigned property manager", "Text", "Jordan Ellis"],
    ["property_manager_email", "Property manager email address", "Email", "jordan@northbridge.example"],
    ["property_manager_phone", "Property manager direct phone", "Phone", "+1 416 555 0172"],
  ]),
  ...define("Unit", [
    ["unit_number", "Unit or suite identifier", "Text", "4B"],
    ["unit_address", "Property address including unit", "Text", "Unit 4B, 218 Sutherland Avenue"],
  ]),
  ...define("Tenant", [
    ["tenant_first_name", "Tenant given name", "Text", "Maya"],
    ["tenant_last_name", "Tenant family name", "Text", "Chen"],
    ["tenant_full_name", "Tenant full display name", "Text", "Maya Chen"],
    ["tenant_email", "Tenant email from the tenant record", "Email", "maya.chen@example.com"],
    ["tenant_phone", "Tenant mobile phone from the tenant record", "Phone", "+1 416 555 0194"],
  ]),
  ...define("Lease", [
    ["lease_start_date", "Start date of the active or proposed lease", "Date", "September 1, 2026"],
    ["lease_end_date", "End date of the lease", "Date", "August 31, 2027"],
    ["lease_status", "Current lease workflow status", "Enum", "Active"],
    ["lease_document_name", "Name of the lease document", "Text", "Residential Tenancy Agreement - 4B"],
    ["signature_link", "Secure electronic signature URL", "URL", "https://sign.northbridge.example/s/7f2a"],
  ]),
  ...define("Finance", [
    ["invoice_number", "Human-readable invoice number", "Text", "INV-2026-1048"],
    ["invoice_date", "Date the invoice was issued", "Date", "August 25, 2026"],
    ["invoice_amount", "Formatted total invoice amount", "Currency", "$2,150.00"],
    ["outstanding_balance", "Current unpaid invoice or ledger balance", "Currency", "$2,150.00"],
    ["due_date", "Payment due date", "Date", "September 1, 2026"],
    ["payment_date", "Date a payment was recorded", "Date", "August 29, 2026"],
    ["payment_amount", "Formatted payment amount", "Currency", "$2,150.00"],
    ["payment_reference", "Payment transaction reference", "Text", "PMT-883104"],
    ["currency", "ISO currency used for monetary values", "Currency code", "CAD"],
  ]),
  ...define("Maintenance", [
    ["maintenance_request_number", "Tenant maintenance request reference", "Text", "MR-2048"],
    ["work_order_number", "Internal work order reference", "Text", "WO-881"],
    ["maintenance_description", "Reported issue or approved work description", "Text", "Kitchen faucet leak"],
    ["scheduled_date", "Confirmed visit or work date", "Date", "September 3, 2026"],
    ["scheduled_time", "Confirmed arrival window", "Time range", "9:00 AM–11:00 AM"],
    ["contractor_name", "Assigned contractor or vendor", "Text", "Harbour Plumbing Ltd."],
    ["maintenance_status", "Current request or work order status", "Enum", "Visit scheduled"],
  ]),
  ...define("Projects", [
    ["project_name", "Renovation or capital project name", "Text", "Corridor Flooring Renewal"],
    ["project_number", "Internal project reference", "Text", "PRJ-2026-014"],
    ["project_start_date", "Current scheduled project start", "Date", "September 14, 2026"],
    ["project_end_date", "Current scheduled project completion", "Date", "October 2, 2026"],
    ["project_status", "Current project workflow status", "Enum", "Scheduled"],
    ["project_description", "Scope and impact summary", "Text", "Replacement of corridor flooring on levels 2–7"],
  ]),
  ...define("Documents", [
    ["document_name", "Document display name", "Text", "Government-issued identification"],
    ["document_expiry_date", "Document expiry date, if tracked", "Date", "December 31, 2026"],
    ["document_download_link", "Authorized document download URL", "URL", "https://portal.northbridge.example/documents/184"],
  ]),
  ...define("System", [
    ["current_date", "Date the message is rendered in the workspace timezone", "Date", "August 29, 2026"],
    ["current_datetime", "Date and time the message is rendered", "Datetime", "August 29, 2026, 10:30 AM EDT"],
    ["company_portal_url", "Authenticated company portal landing page", "URL", "https://portal.northbridge.example/dashboard"],
  ]),
];

export const VARIABLE_MAP = Object.fromEntries(VARIABLE_GROUPS.map((variable) => [variable.name, variable])) as Record<string, VariableDefinition>;
export const VARIABLE_GROUP_NAMES = [...new Set(VARIABLE_GROUPS.map((variable) => variable.group))];
export const ALL_VARIABLE_NAMES = VARIABLE_GROUPS.map((variable) => variable.name);
