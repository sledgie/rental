// Single source of truth for the sidebar and the placeholder pages.
// `id` is the hash route (#/<id>). Items whose id has a real page in App.jsx open that page; the rest open <Placeholder />.
export const BRAND = { name: 'L.O.F.T.', subtitle: 'Landlord Operations & Financial Tracking', icon: 'building-2', home: 'dashboard' };

export const QUICK_ACTION = {
  id: 'invoice-new', label: 'Create New Invoice', icon: 'file-plus',
  desc: 'Draft a new invoice for a tenant, unit or lease, with line items, due dates and taxes.',
};

export const NAV = [
  { id: 'dashboard-group', label: 'Dashboard', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', desc: 'A high-level overview of occupancy, income, expenses and upcoming activity across your portfolio.' },
  ] },
  { id: 'portfolio', label: 'Portfolio', items: [
    { id: 'properties', label: 'Properties', icon: 'building-2', desc: 'Manage the buildings and houses in your portfolio, their details and status.' },
    { id: 'banks', label: 'Banks', icon: 'landmark', desc: 'Bank accounts used for payments, deposits and reconciliation.' },
    { id: 'units', label: 'Units', icon: 'door-open', desc: 'Track every rentable unit, its features, rent and availability.' },
    { id: 'tenants', label: 'Tenants', icon: 'users', desc: 'Keep tenant profiles, contact details and tenancy history in one place.' },
    { id: 'leases', label: 'Leases', icon: 'file-signature', desc: 'Create, renew and monitor lease agreements and their key dates.' },
    { id: 'applications', label: 'Applications', icon: 'file-text', desc: 'Receive and review rental applications and screen prospective tenants.' },
  ] },
  { id: 'operations', label: 'Property Operations', items: [
    { id: 'projects', label: 'Projects', icon: 'folder-kanban', desc: 'Plan and track renovations, property improvements, project schedules, budgets, and related tasks.' },
    { id: 'work-orders', label: 'Work Orders', icon: 'clipboard-list', desc: 'Assign, schedule and follow up on maintenance and repair jobs.' },
    { id: 'maintenance-requests', label: 'Maintenance Requests', icon: 'wrench', desc: 'Collect and triage maintenance requests submitted by tenants and staff.' },
    { id: 'inspections', label: 'Inspections', icon: 'clipboard-check', desc: 'Schedule move-in, move-out and routine inspections with checklists.' },
    { id: 'vendors', label: 'Contractors & Vendors', icon: 'hard-hat', desc: 'Maintain a directory of contractors and vendors, their services and contacts.' },
    { id: 'assets', label: 'Assets & Equipment', icon: 'package', desc: 'Inventory appliances and equipment, with warranties and service history.' },
  ] },
  { id: 'financials', label: 'Financials', items: [
    { id: 'invoices', label: 'Invoices', icon: 'receipt', desc: 'Issue and track invoices sent to tenants and other customers.' },
    { id: 'payments', label: 'Payments', icon: 'wallet', desc: 'Record and reconcile rent and other payments as they are received.' },
    { id: 'deposits', label: 'Deposits', icon: 'shield-check', desc: 'Hold, apply and refund security deposits.' },
    { id: 'expenses', label: 'Expenses & Bills', icon: 'card', desc: 'Capture property expenses and the bills you owe to vendors.' },
    { id: 'accounts', label: 'Accounting', icon: 'calculator', desc: 'Billing, accounts and the general ledger for your rental business.' },
    { id: 'bank-reconciliation', label: 'Bank Reconciliation', icon: 'landmark', desc: 'Match bank transactions against your recorded payments and expenses.' },
  ] },
  { id: 'communication', label: 'Communication', items: [
    { id: 'messages', label: 'Messages', icon: 'messages-square', desc: 'Message tenants, owners and vendors from a single inbox.' },
    { id: 'notifications', label: 'Notifications', icon: 'bell', desc: 'Review alerts about payments, leases, requests and reminders.' },
    { id: 'documents', label: 'Document Center', icon: 'folder-open', desc: 'Store and share leases, notices, receipts and other documents.' },
  ] },
  { id: 'reports-group', label: 'Reports & Analytics', items: [
    { id: 'financial-reports', label: 'Financial Reports', icon: 'trending-up', desc: 'Income statements, cash flow, aging and other financial reports.' },
    { id: 'occupancy-reports', label: 'Occupancy Reports', icon: 'chart-pie', desc: 'Vacancy, turnover and occupancy trends across properties and units.' },
    { id: 'property-performance', label: 'Property Performance', icon: 'chart', desc: 'Compare the income, costs and returns of each property.' },
    { id: 'project-reports', label: 'Project Reports', icon: 'doc', desc: 'Budget versus actual, progress and status for projects.' },
  ] },
  { id: 'automation', label: 'Automation', items: [
    { id: 'workflows', label: 'Workflow Automation', icon: 'workflow', desc: 'Automate repetitive steps such as reminders, approvals and follow-ups.' },
    { id: 'scheduled-tasks', label: 'Scheduled Tasks', icon: 'clock', desc: 'Manage jobs that run on a schedule, such as billing runs and reports.' },
    { id: 'message-templates', label: 'Message Templates', icon: 'mail', desc: 'Create and edit reusable email, SMS and in-app message templates used across the system.' },
    { id: 'activity-logs', label: 'Activity Logs', icon: 'activity', desc: 'An audit trail of who did what, and when.' },
  ] },
  { id: 'settings-group', label: 'Settings', items: [
    { id: 'organization', label: 'Organization', icon: 'building', desc: 'Your organization profile, branding and business details.' },
    { id: 'system-settings', label: 'System Settings', icon: 'gear', desc: 'Defaults and preferences that apply across the application.' },
  ] },
];

const INDEX = {};
for (const g of NAV) for (const item of g.items) INDEX[item.id] = { ...item, group: g };
// the new-invoice page is opened from the Invoices page (no sidebar entry); it belongs to the same group as Invoices
INDEX[QUICK_ACTION.id] = { ...QUICK_ACTION, group: INDEX.invoices?.group ?? { id: 'invoices-group', label: 'Invoices' } };

export const findNav = (id) => INDEX[id];
export const NAV_IDS = Object.keys(INDEX);
export const groupOf = (id) => INDEX[id]?.group.id;
