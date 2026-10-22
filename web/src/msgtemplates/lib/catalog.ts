import type { Channel } from "./types";

export const CATEGORIES = [
  { id: "rent_payments", label: "Rent & Payments", short: "Rent", description: "Invoices, balances, payments and deposits" },
  { id: "lease_tenancy", label: "Lease & Tenancy", short: "Lease", description: "Tenancy lifecycle, signatures and renewals" },
  { id: "maintenance_repairs", label: "Maintenance & Repairs", short: "Maintenance", description: "Requests, work orders and contractor visits" },
  { id: "property_announcements", label: "Property Announcements", short: "Property", description: "Building-wide operational notices" },
  { id: "projects_renovations", label: "Projects & Renovations", short: "Projects", description: "Capital projects, access and disruption" },
  { id: "documents_admin", label: "Documents & Administration", short: "Documents", description: "Documents, signatures and tenant records" },
  { id: "owners_landlords", label: "Owners & Landlords", short: "Owners", description: "Owner reporting, approvals and updates" },
  { id: "vendors_contractors", label: "Vendors & Contractors", short: "Vendors", description: "Quotations, authorization and vendor billing" },
  { id: "internal_admin", label: "Internal Administration", short: "Internal", description: "Tasks, approvals and operations summaries" },
  { id: "system_notifications", label: "System Notifications", short: "System", description: "Account access and security communications" },
] as const;

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((category) => [category.id, category])) as Record<string, (typeof CATEGORIES)[number]>;

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "in_app", label: "In-App" },
];

export const EVENT_GROUPS = [
  { group: "Manual", events: [{ id: "manual", label: "Manual / ad hoc", contexts: ["company", "property", "unit", "tenant", "lease", "finance", "maintenance", "projects", "documents", "system"] }] },
  { group: "Finance", events: [
    { id: "invoice.created", label: "Invoice Created", contexts: ["company", "property", "unit", "tenant", "lease", "finance", "system"] },
    { id: "invoice.due_soon", label: "Invoice Due Soon", contexts: ["company", "property", "unit", "tenant", "finance", "system"] },
    { id: "invoice.due_today", label: "Invoice Due Today", contexts: ["company", "property", "unit", "tenant", "finance", "system"] },
    { id: "invoice.overdue", label: "Invoice Overdue", contexts: ["company", "property", "unit", "tenant", "finance", "system"] },
    { id: "payment.recorded", label: "Payment Recorded", contexts: ["company", "property", "unit", "tenant", "finance", "system"] },
    { id: "payment.failed", label: "Payment Failed", contexts: ["company", "property", "unit", "tenant", "finance", "system"] },
    { id: "balance.updated", label: "Balance Updated", contexts: ["company", "property", "unit", "tenant", "finance", "system"] },
  ] },
  { group: "Leases", events: [
    { id: "tenancy.activated", label: "Tenancy Activated", contexts: ["company", "property", "unit", "tenant", "lease", "system"] },
    { id: "lease.sent_for_signature", label: "Lease Sent for Signature", contexts: ["company", "property", "unit", "tenant", "lease", "documents", "system"] },
    { id: "signature.pending", label: "Signature Pending", contexts: ["company", "property", "unit", "tenant", "lease", "documents", "system"] },
    { id: "lease.signed", label: "Lease Signed", contexts: ["company", "property", "unit", "tenant", "lease", "documents", "system"] },
    { id: "lease.expiring_soon", label: "Lease Expiring Soon", contexts: ["company", "property", "unit", "tenant", "lease", "system"] },
    { id: "lease.renewed", label: "Lease Renewed", contexts: ["company", "property", "unit", "tenant", "lease", "system"] },
    { id: "tenancy.ending", label: "Tenancy Ending", contexts: ["company", "property", "unit", "tenant", "lease", "system"] },
  ] },
  { group: "Maintenance", events: [
    { id: "maintenance.request_created", label: "Request Created", contexts: ["company", "property", "unit", "tenant", "maintenance", "system"] },
    { id: "maintenance.work_order_assigned", label: "Work Order Assigned", contexts: ["company", "property", "unit", "tenant", "maintenance", "system"] },
    { id: "maintenance.visit_scheduled", label: "Visit Scheduled", contexts: ["company", "property", "unit", "tenant", "maintenance", "system"] },
    { id: "maintenance.work_order_delayed", label: "Work Order Delayed", contexts: ["company", "property", "unit", "tenant", "maintenance", "system"] },
    { id: "maintenance.work_order_completed", label: "Work Order Completed", contexts: ["company", "property", "unit", "tenant", "maintenance", "system"] },
  ] },
  { group: "Projects", events: [
    { id: "project.created", label: "Project Created", contexts: ["company", "property", "unit", "tenant", "projects", "system"] },
    { id: "project.schedule_changed", label: "Project Schedule Changed", contexts: ["company", "property", "unit", "tenant", "projects", "system"] },
    { id: "project.unit_access_required", label: "Unit Access Required", contexts: ["company", "property", "unit", "tenant", "projects", "system"] },
    { id: "project.completed", label: "Project Completed", contexts: ["company", "property", "unit", "tenant", "projects", "system"] },
  ] },
  { group: "Documents", events: [
    { id: "document.uploaded", label: "Document Uploaded", contexts: ["company", "property", "unit", "tenant", "documents", "system"] },
    { id: "document.signature_requested", label: "Signature Requested", contexts: ["company", "property", "unit", "tenant", "lease", "documents", "system"] },
    { id: "document.signature_completed", label: "Signature Completed", contexts: ["company", "property", "unit", "tenant", "lease", "documents", "system"] },
    { id: "document.expiring_soon", label: "Document Expiring Soon", contexts: ["company", "property", "unit", "tenant", "documents", "system"] },
  ] },
  { group: "System", events: [
    { id: "user.invited", label: "User Invited", contexts: ["company", "tenant", "system"] },
    { id: "account.security_event", label: "Account Security Event", contexts: ["company", "tenant", "system"] },
    { id: "scheduled.summary", label: "Configured Scheduled Summary", contexts: ["company", "property", "finance", "maintenance", "projects", "system"] },
  ] },
] as const;

export const ALL_EVENTS = EVENT_GROUPS.flatMap((group) => group.events.map((event) => ({ ...event, group: group.group })));
export const EVENT_MAP = Object.fromEntries(ALL_EVENTS.map((event) => [event.id, event])) as Record<string, (typeof ALL_EVENTS)[number]>;

export const CONDITION_FIELDS = [
  { id: "outstanding_balance", label: "Outstanding balance", type: "currency" },
  { id: "invoice_status", label: "Invoice status", type: "text" },
  { id: "days_until_due", label: "Days until due", type: "number" },
  { id: "days_overdue", label: "Days overdue", type: "number" },
  { id: "days_until_lease_end", label: "Days until lease end", type: "number" },
  { id: "lease_status", label: "Lease status", type: "text" },
  { id: "appointment_confirmed", label: "Appointment confirmed", type: "boolean" },
  { id: "maintenance_status", label: "Maintenance status", type: "text" },
  { id: "tenant_channel_opt_in", label: "Tenant channel opt-in", type: "boolean" },
  { id: "affected_tenant", label: "Tenant affected by project", type: "boolean" },
  { id: "property_id", label: "Property ID", type: "text" },
];

export const TIMEZONES = ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax", "America/St_Johns"];
export const CANADIAN_JURISDICTIONS = ["Federal / general", "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Northwest Territories", "Nunavut", "Yukon"];

export const PROPERTIES = [
  { id: "prop-sutherland", name: "The Sutherland", address: "218 Sutherland Avenue, Toronto, ON", manager: "Jordan Ellis", units: ["4B", "2A", "7C"] },
  { id: "prop-harbour", name: "Harbour Court", address: "85 Harbour Street, Vancouver, BC", manager: "Priya Shah", units: ["1204", "308", "1502"] },
  { id: "prop-willow", name: "Willow & Main", address: "44 Main Street, Calgary, AB", manager: "Jordan Ellis", units: ["103", "205", "311"] },
];

export const DEFAULT_SENDER = {
  fromName: "Northbridge Residential",
  fromEmail: "updates@northbridge.example",
  replyTo: "support@northbridge.example",
  cc: "",
  bcc: "",
  signature: "<p>Kind regards,<br><strong>{{property_manager_name}}</strong><br>{{company_name}}<br>{{company_phone}}</p>",
};
