import type { ListItem, Organization, OrgSettings, Role, UserPreferences } from "./types";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const ACCOUNT_OPTIONS = [
  { group: "Assets", options: ["1010 · Operating checking", "1020 · Security deposit trust", "1030 · Reserve savings"] },
  { group: "Liabilities", options: ["2100 · Accounts payable", "2200 · Tenant security deposits", "2300 · Owner distributions payable"] },
  { group: "Income", options: ["4100 · Rental income", "4150 · Late fee income", "4200 · Parking & ancillary income"] },
  { group: "Expenses", options: ["6100 · Property taxes", "6200 · Operating expenses", "6300 · Repairs & maintenance", "6400 · Utilities", "6500 · Management fees"] },
];

export const LEASE_TEMPLATES = [
  "Standard residential lease (v4)",
  "Month-to-month rental agreement (v2)",
  "Single-family home lease (v3)",
  "Condominium lease addendum (v1)",
];

export const SECURITY_PERMISSIONS = [
  { id: "view_settings", label: "View organization settings", hint: "Read all workspace configuration" },
  { id: "edit_settings", label: "Edit organization settings", hint: "Change workspace-wide defaults" },
  { id: "financial_defaults", label: "Manage financial defaults", hint: "Chart of accounts, rent rules, taxes" },
  { id: "financial_reports", label: "View financial reports", hint: "Income, expenses and owner statements" },
  { id: "properties", label: "Manage properties & leases", hint: "Create and edit portfolio records" },
  { id: "maintenance", label: "Manage maintenance", hint: "Work orders, vendors and approvals" },
  { id: "members", label: "Manage members & roles", hint: "Invite and update team access" },
  { id: "export_data", label: "Export organization data", hint: "Configuration, activity and reference data" },
  { id: "audit_log", label: "View audit log", hint: "Security and administrative events" },
];

const matrix = (values: Partial<Record<Role, string[]>>): Record<Role, Record<string, boolean>> => {
  const roles: Role[] = [
    "Owner",
    "Administrator",
    "Property Manager",
    "Accountant",
    "Maintenance Staff",
    "Read-Only / Auditor",
  ];
  return roles.reduce(
    (acc, role) => {
      acc[role] = SECURITY_PERMISSIONS.reduce(
        (row, permission) => {
          row[permission.id] = (values[role] ?? []).includes(permission.id);
          return row;
        },
        {} as Record<string, boolean>,
      );
      return acc;
    },
    {} as Record<Role, Record<string, boolean>>,
  );
};

const DEFAULT_MATRIX = matrix({
  Owner: SECURITY_PERMISSIONS.map((p) => p.id),
  Administrator: [
    "view_settings", "edit_settings", "financial_defaults", "financial_reports", "properties", "maintenance",
    "members", "export_data", "audit_log",
  ],
  "Property Manager": ["view_settings", "properties", "maintenance", "export_data"],
  Accountant: ["view_settings", "financial_defaults", "financial_reports", "export_data", "audit_log"],
  "Maintenance Staff": ["view_settings", "maintenance"],
  "Read-Only / Auditor": ["view_settings", "financial_reports", "audit_log"],
});

const list = (labels: string[], disableable = false): ListItem[] =>
  labels.map((label, i) => ({
    id: `li_${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${i}`,
    label,
    ...(disableable ? { enabled: true } : {}),
  }));

const notificationEvent = (
  inApp: boolean,
  email: boolean,
  sms: boolean,
  recipients: string,
) => ({ inApp, email, sms, recipients });

export function defaultOrganizationSettings(org: Organization): OrgSettings {
  const domain = `${org.shortName.toLowerCase().replace(/[^a-z]/g, "")}.com`;
  return {
    general: {
      reportingPeriod: "Month to date",
      portfolioView: "Grid",
      tablePageSize: "25",
      dateFormat: "MMM d, yyyy",
      timeFormat: "12-hour",
      currencyDisplay: "Symbol · $1,250.00",
      confirmDestructive: true,
      defaultSort: "Recently updated",
      defaultFilter: "Active records",
      documentPreview: "Side panel",
    },
    financial: {
      chartOfAccounts: "Standard property chart",
      incomeAccount: "4100 · Rental income",
      operatingExpenseAccount: "6200 · Operating expenses",
      repairExpenseAccount: "6300 · Repairs & maintenance",
      depositLiabilityAccount: "2200 · Tenant security deposits",
      bankAccount: "1010 · Operating checking",
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1042,
      paymentTerms: "Net 15",
      dueDateCalculation: "Issue date + payment terms",
      rentDueDay: 1,
      gracePeriod: 5,
      lateFeeMethod: "Fixed amount",
      lateFeeAmount: 75,
      lateFeePercent: 5,
      lateFeeCap: 250,
      taxName: "State rental tax",
      taxRate: 8.25,
      taxInclusive: false,
      paymentInstructions: `Pay online from the tenant portal. Checks are payable to ${org.name} and must include the unit number. Please allow 3 business days for processing.`,
      depositRefund: "Original payment method within 21 days",
      financialReportingPeriod: "Calendar month",
      approvalThreshold: 5000,
    },
    property: {
      propertyType: "Multi-unit building",
      unitType: "1 bedroom / 1 bathroom",
      leaseDuration: 12,
      rentDueDay: 1,
      renewalNoticeDays: 60,
      renewalReminderDays: 45,
      inspectionFrequency: "Semi-annual",
      leaseTemplate: "Standard residential lease (v4)",
      utilityResponsibility: "Tenant pays electricity; owner pays water & sewer",
      recurringCharges: true,
      prorateFirstMonth: true,
      recurringDueDay: 1,
      moveInChecklist: list([
        "Signed lease and addenda on file",
        "Security deposit and first month received",
        "Keys and access devices issued",
        "Unit photos and meter readings recorded",
        "Utility transfer confirmed",
      ]),
      moveOutChecklist: list([
        "Forwarding address collected",
        "Final walkthrough completed",
        "Keys returned and locks verified",
        "Meter readings and final photos recorded",
        "Deposit disposition scheduled",
      ]),
      tenantDocs: ["Government-issued ID", "Proof of income", "Renter's insurance", "Pet vaccination records"],
    },
    maintenance: {
      workOrderPrefix: "WO-",
      nextWorkOrderNumber: 238,
      categories: [
        { id: "cat_plumbing", label: "Plumbing", enabled: true },
        { id: "cat_electrical", label: "Electrical", enabled: true },
        { id: "cat_hvac", label: "Heating & cooling", enabled: true },
        { id: "cat_appliance", label: "Appliance repair", enabled: true },
        { id: "cat_structural", label: "Structural & roofing", enabled: true },
        { id: "cat_landscaping", label: "Landscaping & grounds", enabled: false },
      ],
      defaultStatus: "Open · Unassigned",
      assignmentMethod: "Property manager triage",
      lowResponse: 48,
      normalResponse: 24,
      highResponse: 8,
      emergencyResponse: 1,
      vendorApproval: true,
      insuranceReminder: true,
      insuranceReminderDays: 30,
      approvalThreshold: 2500,
      checklist: list([
        "Confirm tenant availability for access",
        "Capture request photos and unit details",
        "Assign vendor and confirm ETA",
        "Document completed work and cost",
        "Notify tenant and close work order",
      ]),
      emergencyInstructions:
        "For active leaks, loss of heat, electrical hazards or lockouts, call the on-call line at (503) 555-0199 immediately. Escalate to the duty property manager if there is no response within 15 minutes. Never enter an occupied unit without tenant consent except in an emergency.",
    },
    projects: {
      projectPrefix: "PRJ-",
      nextProjectNumber: 118,
      defaultPriority: "Normal",
      categories: [
        { id: "pc_interior", label: "Interior renovation", enabled: true },
        { id: "pc_exterior", label: "Exterior & curb appeal", enabled: true },
        { id: "pc_systems", label: "Systems & infrastructure", enabled: true },
        { id: "pc_amenity", label: "Amenity improvement", enabled: true },
        { id: "pc_compliance", label: "Code & compliance", enabled: true },
      ],
      statuses: [
        { id: "ps_planning", label: "Planning", enabled: true },
        { id: "ps_approved", label: "Approved", enabled: true },
        { id: "ps_active", label: "In progress", enabled: true },
        { id: "ps_onhold", label: "On hold", enabled: true },
        { id: "ps_complete", label: "Completed", enabled: true },
      ],
      budgetWarningThreshold: 85,
      approvalThreshold: 10000,
      managerAssignment: "Assign property manager by portfolio",
      budgetOverrunNotify: true,
      overrunRecipients: "Owners & Administrators",
      requiredDocs: list([
        "Approved scope of work",
        "Contractor estimate or bid",
        "Signed contract and insurance certificate",
        "Permits where required",
      ]),
      completionChecklist: list([
        "Punch-list walkthrough completed",
        "Final invoices and lien waivers collected",
        "Photos uploaded to the property file",
        "Budget reconciliation approved",
      ]),
    },
    notifications: {
      events: {
        rentDue: notificationEvent(true, true, true, "Tenants"),
        overdueRent: notificationEvent(true, true, false, "Owners & Property Managers"),
        leaseRenewal: notificationEvent(true, true, false, "Property Managers"),
        maintenance: notificationEvent(true, true, false, "Maintenance Staff"),
        emergency: notificationEvent(true, true, true, "Owners & on-call staff"),
        projectBudget: notificationEvent(true, true, false, "Owners & Administrators"),
        invoicePayment: notificationEvent(true, true, false, "Accountants"),
        taskFailure: notificationEvent(true, true, false, "Administrators"),
        automationFailure: notificationEvent(true, false, false, "Administrators"),
      },
      senderName: org.name,
      replyTo: `billing@${domain}`,
      communicationStart: "08:00",
      communicationEnd: "19:00",
      timezone: "America/Los_Angeles — Pacific",
      dailyDigest: true,
    },
    tasks: {
      timezone: "America/Los_Angeles — Pacific",
      windowStart: "01:00",
      windowEnd: "05:00",
      failureNotifications: true,
      failureRecipients: "Owners & Administrators",
      retryCount: 3,
      retryIntervalMinutes: 15,
      retentionMonths: 24,
      reminderTiming: "24 hours before",
      missedTaskAlerts: true,
      missedTaskRecipients: "Administrators",
    },
    workflow: {
      enabled: true,
      requireApproval: true,
      failureNotifications: true,
      failureRecipients: "Administrators",
      retryPolicy: "Exponential backoff",
      retryCount: 3,
      retentionMonths: 12,
      financialAutomations: "Require approval",
      externalCommunications: "Require approval",
      maxRunsPerDay: 500,
      maxConcurrent: 10,
    },
    documents: {
      categories: [
        { id: "dc_lease", label: "Leases & addenda", enabled: true },
        { id: "dc_tenant", label: "Tenant records", enabled: true },
        { id: "dc_property", label: "Property records", enabled: true },
        { id: "dc_financial", label: "Financial documents", enabled: true },
        { id: "dc_maintenance", label: "Maintenance & inspections", enabled: true },
        { id: "dc_legal", label: "Legal & compliance", enabled: false },
      ],
      defaultLeaseTemplate: "Standard residential lease (v4)",
      leaseTemplate: "Standard residential lease (v4)",
      namingConvention: "{property}_{tenant}_{documentType}_{date}",
      allowedTypes: ["PDF", "DOCX", "JPG", "PNG"],
      maxUploadMb: 25,
      retentionPolicy: "7 years after lease end",
      reminderDays: 14,
      signatureExpiryDays: 30,
      signerReminderDays: 3,
      accessDefault: "Organization members",
      archiveSigned: true,
      archiveLocation: "Organization file storage",
      esignProvider: "Not connected",
    },
    security: {
      matrix: JSON.parse(JSON.stringify(DEFAULT_MATRIX)),
      sessionTimeout: "30 minutes",
      invitationExpiryDays: 7,
      suspensionPolicy: "Suspend after 10 failed sign-in attempts",
      sensitiveFinancialAction: "Require Owner or Administrator approval",
      documentAccess: "Role-based access",
      auditTracking: true,
      auditEvents: {
        signIn: true,
        permissionChanges: true,
        financialEdits: true,
        exports: true,
      },
      securityAlerts: {
        failedSignIn: true,
        newDevice: true,
        roleChange: true,
        exportFailure: false,
      },
    },
    data: {
      retentionYears: 7,
      activityRetentionMonths: 24,
      archiveInactiveProperties: true,
      archiveAfterMonths: 12,
      exportFormat: "JSON",
      keepExportedAuditCopy: true,
      importMode: "Preview before applying",
    },
  };
}

export function defaultUserPreferences(theme: UserPreferences["theme"]): UserPreferences {
  return {
    theme,
    landingPage: "Dashboard overview",
    language: "English (United States)",
    tableDensity: "Comfortable",
    notifications: { email: true, desktop: true, weeklyDigest: true, productUpdates: false },
    widgets: { occupancy: true, rentCollection: true, maintenance: true, renewals: true },
    reduceMotion: false,
  };
}

export const ROLE_TONES: Record<Role, string> = {
  Owner: "bg-u-accent-soft text-u-accent ring-u-accent/15   ",
  Administrator: "bg-u-accent-soft text-u-accent ring-u-accent/15   ",
  "Property Manager": "bg-u-ok-soft text-u-ok ring-u-ok/15   ",
  Accountant: "bg-u-warn-soft text-u-warn ring-u-warn/15   ",
  "Maintenance Staff": "bg-u-violet/15 text-u-violet ring-u-violet/15   ",
  "Read-Only / Auditor": "bg-u-s3 text-u-ink2 ring-u-line2/15   ",
};
