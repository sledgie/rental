import { db } from "./";
import * as schema from "./schema";
import { eq } from "./ops";
import { addDaysISO, addMonthsISO, endOfMonthISO, startOfMonthISO, todayISO } from "../lib/dates";
import { roundHalfUp } from "../lib/money";
import { calculateInterest, type RateLike } from "../lib/deposits/engine";

const SEED_VERSION = "deposits-demo-v1";

type TxnDraft = typeof schema.depositTransactions.$inferInsert;
type JournalDraft = typeof schema.journalEntries.$inferInsert;
type LineDraft = typeof schema.journalLines.$inferInsert;
type PaymentDraft = typeof schema.payments.$inferInsert;

export async function ensureSeeded(): Promise<void> {
  const meta = await db.select().from(schema.appMeta);
  if (meta.some((m) => m.key === "seed_version" && m.value === SEED_VERSION)) return;
  await seedDatabase();
}

async function seedDatabase(): Promise<void> {
  const today = todayISO();
  const d = (offset: number) => addDaysISO(today, offset);
  const m = (offset: number) => addMonthsISO(today, offset);

  /* ---------------------------------- Staff ---------------------------------- */
  const staffRows = [
    { id: "staff-admin", name: "Alex Morgan", role: "admin", title: "Director, Operations", initials: "AM", email: "alex.morgan@meridianpm.ca" },
    { id: "staff-controller", name: "Priya Raman", role: "controller", title: "Financial Controller", initials: "PR", email: "priya.raman@meridianpm.ca" },
    { id: "staff-manager", name: "Danielle Osei", role: "property_manager", title: "Senior Property Manager", initials: "DO", email: "danielle.osei@meridianpm.ca" },
    { id: "staff-auditor", name: "Sam Whitfield", role: "auditor", title: "Internal Auditor", initials: "SW", email: "sam.whitfield@meridianpm.ca" },
  ];

  /* -------------------------------- Properties -------------------------------- */
  const propertyRows = [
    { id: "prop-harbourview", name: "Harbourview Residences", building: "Tower A", addressLine: "88 Queens Quay W", city: "Toronto", province: "ON", jurisdiction: "ON", unitsCount: 164 },
    { id: "prop-cedargrove", name: "Cedar Grove Walk-ups", building: "Building 2", addressLine: "1420 Cedar Grove Rd", city: "Ottawa", province: "ON", jurisdiction: "ON", unitsCount: 48 },
    { id: "prop-prairie", name: "Prairie Business Centre", building: "East Wing", addressLine: "600 8 Ave SW", city: "Calgary", province: "AB", jurisdiction: "AB", unitsCount: 62 },
    { id: "prop-pacific", name: "Pacific Mews", building: "Mews 1", addressLine: "715 Johnson St", city: "Victoria", province: "BC", jurisdiction: "BC", unitsCount: 36 },
  ];

  const unitRows = [
    { id: "unit-hv-1204", propertyId: "prop-harbourview", label: "1204", bedrooms: "2 bed", monthlyRentCents: 245000, status: "occupied" },
    { id: "unit-hv-805", propertyId: "prop-harbourview", label: "805", bedrooms: "1 bed", monthlyRentCents: 215000, status: "vacant" },
    { id: "unit-hv-c1", propertyId: "prop-harbourview", label: "C1 (retail)", bedrooms: "Commercial", monthlyRentCents: 540000, status: "occupied" },
    { id: "unit-cg-12", propertyId: "prop-cedargrove", label: "12", bedrooms: "2 bed", monthlyRentCents: 185000, status: "occupied" },
    { id: "unit-cg-07", propertyId: "prop-cedargrove", label: "7", bedrooms: "1 bed", monthlyRentCents: 172000, status: "occupied" },
    { id: "unit-cg-03", propertyId: "prop-cedargrove", label: "3", bedrooms: "1 bed", monthlyRentCents: 195000, status: "occupied" },
    { id: "unit-pb-210", propertyId: "prop-prairie", label: "210", bedrooms: "Office", monthlyRentCents: 480000, status: "occupied" },
    { id: "unit-pb-320", propertyId: "prop-prairie", label: "320", bedrooms: "Office", monthlyRentCents: 615000, status: "occupied" },
    { id: "unit-pm-04", propertyId: "prop-pacific", label: "4", bedrooms: "1 bed + den", monthlyRentCents: 210000, status: "occupied" },
    { id: "unit-pm-09", propertyId: "prop-pacific", label: "9", bedrooms: "1 bed", monthlyRentCents: 198000, status: "vacant" },
  ];

  /* --------------------------------- Tenants --------------------------------- */
  const tenantRows = [
    { id: "ten-chen", name: "Maya Chen", email: "maya.chen@example.com", phone: "416-555-0114" },
    { id: "ten-okafor", name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "416-555-0181" },
    { id: "ten-shah", name: "Priyanka Shah", email: "priyanka.shah@example.com", phone: "613-555-0147" },
    { id: "ten-oconnor", name: "Liam O'Connor", email: "liam.oconnor@example.com", phone: "613-555-0192" },
    { id: "ten-bergeron", name: "Grace Bergeron", email: "grace.bergeron@example.com", phone: "613-555-0163" },
    { id: "ten-northwind", name: "Northwind Studio Ltd.", email: "accounts@northwindstudio.example", phone: "403-555-0101" },
    { id: "ten-summit", name: "Summit Analytics Inc.", email: "finance@summitanalytics.example", phone: "403-555-0129" },
    { id: "ten-rossi", name: "Elena Rossi", email: "elena.rossi@example.com", phone: "250-555-0188" },
    { id: "ten-bell", name: "Marcus Bell", email: "marcus.bell@example.com", phone: "250-555-0142" },
    { id: "ten-cascadia", name: "Cascadia Retail Group", email: "leases@cascadiaretail.example", phone: "416-555-0220" },
  ];

  /* ---------------------------------- Leases ---------------------------------- */
  const leaseRows = [
    { id: "lease-hv1204", reference: "LSE-2024-0188", tenantId: "ten-chen", propertyId: "prop-harbourview", unitId: "unit-hv-1204", leaseType: "residential", jurisdiction: "ON", startDate: m(-23), endDate: d(45), monthlyRentCents: 245000, status: "notice", notes: "Tenant served N9 — vacating at end of term." },
    { id: "lease-hv0805", reference: "LSE-2024-0142", tenantId: "ten-okafor", propertyId: "prop-harbourview", unitId: "unit-hv-805", leaseType: "residential", jurisdiction: "ON", startDate: m(-20), endDate: d(-30), monthlyRentCents: 215000, status: "ended", notes: "Tenancy ended; final period settled from LMR deposit." },
    { id: "lease-cg12", reference: "LSE-2025-0301", tenantId: "ten-shah", propertyId: "prop-cedargrove", unitId: "unit-cg-12", leaseType: "residential", jurisdiction: "ON", startDate: m(-8), endDate: d(300), monthlyRentCents: 185000, status: "active", notes: "Expected deposit not received at move-in." },
    { id: "lease-cg07", reference: "LSE-2023-0091", tenantId: "ten-oconnor", propertyId: "prop-cedargrove", unitId: "unit-cg-07", leaseType: "residential", jurisdiction: "ON", startDate: m(-35), endDate: d(200), monthlyRentCents: 172000, status: "active", notes: "Lawful rent increase 2.1% applied; LMR interest credited." },
    { id: "lease-cg03", reference: "LSE-2026-0044", tenantId: "ten-bergeron", propertyId: "prop-cedargrove", unitId: "unit-cg-03", leaseType: "residential", jurisdiction: "ON", startDate: m(-1), endDate: d(700), monthlyRentCents: 195000, status: "active", notes: "New tenancy — partial LMR received." },
    { id: "lease-pb210", reference: "LSE-2024-0321", tenantId: "ten-northwind", propertyId: "prop-prairie", unitId: "unit-pb-210", leaseType: "commercial", jurisdiction: "AB", startDate: m(-14), endDate: d(400), monthlyRentCents: 480000, status: "active", notes: "Commercial lease with security deposit per Alberta terms." },
    { id: "lease-pb320", reference: "LSE-2022-0704", tenantId: "ten-summit", propertyId: "prop-prairie", unitId: "unit-pb-320", leaseType: "commercial", jurisdiction: "AB", startDate: m(-30), endDate: d(500), monthlyRentCents: 615000, status: "active", notes: "Utility deposit collected separately." },
    { id: "lease-pm04", reference: "LSE-2024-0410", tenantId: "ten-rossi", propertyId: "prop-pacific", unitId: "unit-pm-04", leaseType: "residential", jurisdiction: "BC", startDate: m(-22), endDate: d(120), monthlyRentCents: 210000, status: "active", notes: "BC security deposit at half month's rent." },
    { id: "lease-pm09", reference: "LSE-2024-0522", tenantId: "ten-bell", propertyId: "prop-pacific", unitId: "unit-pm-09", leaseType: "residential", jurisdiction: "BC", startDate: m(-18), endDate: d(-10), monthlyRentCents: 198000, status: "ended", notes: "Tenancy ended; refund approved with interest." },
    { id: "lease-hvc1", reference: "LSE-2023-0505", tenantId: "ten-cascadia", propertyId: "prop-harbourview", unitId: "unit-hv-c1", leaseType: "commercial", jurisdiction: "ON", startDate: m(-24), endDate: d(365), monthlyRentCents: 540000, status: "active", notes: "Retail tenancy with commercial security deposit." },
  ];

  /* ------------------------------ Chart of accounts ------------------------------ */
  const accountRows = [
    { code: "1010", name: "Operating Bank — Deposits", type: "asset", subtype: "bank", isActive: true },
    { code: "1020", name: "Trust Account — Tenant Deposits", type: "asset", subtype: "trust", isActive: true },
    { code: "1200", name: "Rent Receivable", type: "asset", subtype: "receivable", isActive: true },
    { code: "2200", name: "Last Month's Rent Deposits Payable", type: "liability", subtype: "tenant_deposit", isActive: true },
    { code: "2210", name: "Refundable Key Deposits Payable", type: "liability", subtype: "tenant_deposit", isActive: true },
    { code: "2220", name: "Security Deposits Payable", type: "liability", subtype: "tenant_deposit", isActive: true },
    { code: "2230", name: "Utility Deposits Payable", type: "liability", subtype: "tenant_deposit", isActive: true },
    { code: "2240", name: "Other Tenant Deposits Payable", type: "liability", subtype: "tenant_deposit", isActive: true },
    { code: "2310", name: "Tenant Deposit Interest Payable", type: "liability", subtype: "interest", isActive: true },
    { code: "4000", name: "Rental Income", type: "income", subtype: "rent", isActive: true },
    { code: "6100", name: "Tenant Deposit Interest Expense", type: "expense", subtype: "interest", isActive: true },
  ];

  /* ---------------------------------- Rules ---------------------------------- */
  type RuleSeed = typeof schema.depositRules.$inferInsert;
  const baseRule = {
    maxAmountCents: null as number | null,
    maxMultipleOfRentBps: null as number | null,
    notes: null as string | null,
    configuredBy: "staff-admin",
  };
  const ruleRows: RuleSeed[] = [
    {
      ...baseRule,
      id: "rule-on-res-lmr-2026",
      jurisdiction: "ON", leaseType: "residential", depositType: "last_month_rent",
      collectionPermitted: true, maxMultipleOfRentBps: 10000, calculationMethod: "rent_multiple",
      refundConditions: "Refundable if the tenancy ends before the final rental period, or where an over-collection exists. Otherwise applied to the final rental period.",
      interestApplicable: true, interestMethod: "simple_actual_365", interestFrequency: "annual",
      applicationPurposes: ["final_rental_period", "rent_increase_credit"],
      requiredDocuments: ["Signed lease agreement", "Deposit receipt", "Notice of termination (if applicable)"],
      approvalRequired: false, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2026-01-01", effectiveTo: null,
      validationMessage: "Ontario residential last month's rent deposits cannot exceed one month's rent and may only be applied to the final rental period.",
      legalReference: "Residential Tenancies Act (Ontario) s.105–106",
      notes: "Interest follows the annual rent increase guideline; rate history is effective-dated.",
    },
    {
      ...baseRule,
      id: "rule-on-res-lmr-2023",
      jurisdiction: "ON", leaseType: "residential", depositType: "last_month_rent",
      collectionPermitted: true, maxMultipleOfRentBps: 10000, calculationMethod: "rent_multiple",
      refundConditions: "Refundable on early termination or over-collection; otherwise applied to the final rental period.",
      interestApplicable: true, interestMethod: "simple_actual_365", interestFrequency: "annual",
      applicationPurposes: ["final_rental_period", "rent_increase_credit"],
      requiredDocuments: ["Signed lease agreement", "Deposit receipt"],
      approvalRequired: false, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: "2025-12-31",
      validationMessage: "Ontario residential last month's rent deposits cannot exceed one month's rent.",
      legalReference: "Residential Tenancies Act (Ontario) s.105–106",
      notes: "Superseded version retained for historical evaluation.",
    },
    {
      ...baseRule,
      id: "rule-on-res-key",
      jurisdiction: "ON", leaseType: "residential", depositType: "key_fob",
      collectionPermitted: true, calculationMethod: "replacement_cost",
      refundConditions: "Refundable when every key, fob and access device is returned. Only a documented replacement cost for unreturned devices may be retained.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [],
      requiredDocuments: ["Key receipt / device register", "Replacement cost documentation"],
      approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2024-06-01", effectiveTo: null,
      validationMessage: "A key/fob deposit must not exceed the reasonable expected replacement cost of the devices provided, and is refundable on return.",
      legalReference: "RTA (Ontario) s.105(2) — refundable key deposits",
    },
    {
      ...baseRule,
      id: "rule-on-res-key-2023",
      jurisdiction: "ON", leaseType: "residential", depositType: "key_fob",
      collectionPermitted: true, maxAmountCents: 10000, calculationMethod: "fixed",
      refundConditions: "Refundable on return of all keys and access devices.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [], requiredDocuments: ["Key receipt"],
      approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: "2024-05-31",
      validationMessage: "Legacy key deposit cap of $100.00 applies to this period.",
      legalReference: "Former Ontario key deposit policy",
      notes: "Historical version — superseded by replacement-cost basis on 2024-06-01.",
    },
    {
      ...baseRule,
      id: "rule-on-res-security",
      jurisdiction: "ON", leaseType: "residential", depositType: "security_deposit",
      collectionPermitted: false, calculationMethod: "fixed",
      refundConditions: "Not applicable — collection is prohibited.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [], requiredDocuments: [],
      approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Security, damage and pet deposits are prohibited for Ontario residential tenancies. The normal workflow is blocked; an authorized configuration change is required to hold such funds.",
      legalReference: "RTA (Ontario) s.105(1) — prohibited deposits",
    },
    {
      ...baseRule,
      id: "rule-on-res-pet",
      jurisdiction: "ON", leaseType: "residential", depositType: "pet_deposit",
      collectionPermitted: false, calculationMethod: "fixed",
      refundConditions: "Not applicable — collection is prohibited.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [], requiredDocuments: [],
      approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Pet deposits cannot be collected for Ontario residential tenancies (RTA s.105).",
      legalReference: "RTA (Ontario) s.105(1)",
    },
    {
      ...baseRule,
      id: "rule-on-res-utility",
      jurisdiction: "ON", leaseType: "residential", depositType: "utility_deposit",
      collectionPermitted: false, calculationMethod: "fixed",
      refundConditions: "Not applicable — collection is prohibited.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [], requiredDocuments: [],
      approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Utility deposits are not a permitted deposit category for Ontario residential tenancies.",
      legalReference: "RTA (Ontario) s.105(1)",
    },
    {
      ...baseRule,
      id: "rule-on-res-other",
      jurisdiction: "ON", leaseType: "residential", depositType: "other_permitted",
      collectionPermitted: false, calculationMethod: "fixed",
      refundConditions: "Not applicable until an authorized configuration is recorded.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [], requiredDocuments: [],
      approvalRequired: true, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "No other residential deposit category is configured for Ontario. Authorized configuration is required before any amount can be collected.",
      legalReference: "Deposit rule not configured — warning required",
    },
    {
      ...baseRule,
      id: "rule-bc-res-security",
      jurisdiction: "BC", leaseType: "residential", depositType: "security_deposit",
      collectionPermitted: true, maxMultipleOfRentBps: 5000, calculationMethod: "rent_multiple",
      refundConditions: "Refundable with written condition report after move-out; interest must be paid or credited.",
      interestApplicable: true, interestMethod: "simple_actual_365", interestFrequency: "annual",
      applicationPurposes: ["damage_beyond_normal_wear", "lawful_arrears"],
      requiredDocuments: ["Condition inspection report", "Signed tenancy agreement"],
      approvalRequired: true, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "British Columbia residential security deposits may not exceed half of one month's rent.",
      legalReference: "Residential Tenancy Act (BC) s.38–39",
    },
    {
      ...baseRule,
      id: "rule-bc-res-lmr",
      jurisdiction: "BC", leaseType: "residential", depositType: "last_month_rent",
      collectionPermitted: false, calculationMethod: "fixed",
      refundConditions: "Not applicable — collection is prohibited.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: [], requiredDocuments: [],
      approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "British Columbia does not recognise a separate last month's rent deposit. Use a security deposit per RTA (BC) s.38.",
      legalReference: "Residential Tenancy Act (BC) s.38",
    },
    {
      ...baseRule,
      id: "rule-bc-res-key",
      jurisdiction: "BC", leaseType: "residential", depositType: "key_fob",
      collectionPermitted: true, calculationMethod: "replacement_cost",
      refundConditions: "Refundable on return of all devices; documented replacement cost only may be retained.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none", applicationPurposes: [],
      requiredDocuments: ["Key register"], approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Key deposits must not exceed the documented replacement cost of the devices.",
      legalReference: "Residential Tenancy Act (BC) s.38",
    },
    {
      ...baseRule,
      id: "rule-ab-com-security",
      jurisdiction: "AB", leaseType: "commercial", depositType: "security_deposit",
      collectionPermitted: true, calculationMethod: "fixed",
      refundConditions: "Refundable after lease end and final reconciliation, net of documented and approved deductions.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: ["damage_beyond_normal_wear", "lawful_arrears", "outstanding_utilities", "other_authorized_charge"],
      requiredDocuments: ["Commercial lease", "Move-out inspection", "Deduction approval"],
      approvalRequired: true, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Commercial security deposit deductions require documented approval and may not include ordinary wear and tear.",
      legalReference: "Alberta commercial lease terms (negotiated)",
    },
    {
      ...baseRule,
      id: "rule-ab-com-utility",
      jurisdiction: "AB", leaseType: "commercial", depositType: "utility_deposit",
      collectionPermitted: true, maxAmountCents: 200000, calculationMethod: "fixed",
      refundConditions: "Refundable upon final utility reconciliation at lease end.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: ["outstanding_utilities", "other_authorized_charge"],
      requiredDocuments: ["Utility account confirmation"], approvalRequired: true, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Commercial utility deposits may not exceed $2,000.00 under the negotiated lease terms.",
      legalReference: "Alberta commercial lease terms (negotiated)",
    },
    {
      ...baseRule,
      id: "rule-ab-com-key",
      jurisdiction: "AB", leaseType: "commercial", depositType: "key_fob",
      collectionPermitted: true, calculationMethod: "replacement_cost",
      refundConditions: "Refundable on return of all access devices.", interestApplicable: false,
      interestMethod: "none", interestFrequency: "none", applicationPurposes: [],
      requiredDocuments: ["Access device register"], approvalRequired: false, refundApprovalRequired: false, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Key deposits may not exceed documented replacement cost.",
      legalReference: "Alberta commercial lease terms",
    },
    {
      ...baseRule,
      id: "rule-on-com-security",
      jurisdiction: "ON", leaseType: "commercial", depositType: "security_deposit",
      collectionPermitted: true, calculationMethod: "fixed",
      refundConditions: "Refundable after lease end and final reconciliation, net of documented approved deductions.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: ["damage_beyond_normal_wear", "lawful_arrears", "outstanding_utilities", "other_authorized_charge"],
      requiredDocuments: ["Commercial lease", "Move-out inspection", "Approved deduction schedule"],
      approvalRequired: true, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Commercial security deposit deductions require prior written approval and supporting documentation.",
      legalReference: "Commercial lease agreement, Article 12",
    },
    {
      ...baseRule,
      id: "rule-on-com-lmr",
      jurisdiction: "ON", leaseType: "commercial", depositType: "last_month_rent",
      collectionPermitted: true, maxMultipleOfRentBps: 20000, calculationMethod: "rent_multiple",
      refundConditions: "Applied to the final rental period or refunded per the lease agreement.",
      interestApplicable: false, interestMethod: "none", interestFrequency: "none",
      applicationPurposes: ["final_rental_period", "lawful_arrears"],
      requiredDocuments: ["Commercial lease"], approvalRequired: true, refundApprovalRequired: true, roundingMode: "half_up_cent",
      effectiveFrom: "2023-01-01", effectiveTo: null,
      validationMessage: "Commercial prepaid rent may not exceed two months unless documented in the lease.",
      legalReference: "Commercial lease agreement, Article 4",
    },
  ];

  const rateRows = [
    { id: "rate-on-lmr-2023", jurisdiction: "ON", leaseType: "residential", depositType: "last_month_rent", annualRateBps: 250, effectiveFrom: "2023-01-01", effectiveTo: "2023-12-31", source: "Ontario rent increase guideline 2023 (2.50%)", notes: "Demo rate data." },
    { id: "rate-on-lmr-2024", jurisdiction: "ON", leaseType: "residential", depositType: "last_month_rent", annualRateBps: 250, effectiveFrom: "2024-01-01", effectiveTo: "2024-12-31", source: "Ontario rent increase guideline 2024 (2.50%)", notes: "Demo rate data." },
    { id: "rate-on-lmr-2025", jurisdiction: "ON", leaseType: "residential", depositType: "last_month_rent", annualRateBps: 250, effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", source: "Ontario rent increase guideline 2025 (2.50%)", notes: "Demo rate data." },
    { id: "rate-on-lmr-2026", jurisdiction: "ON", leaseType: "residential", depositType: "last_month_rent", annualRateBps: 210, effectiveFrom: "2026-01-01", effectiveTo: null, source: "Ontario rent increase guideline 2026 (2.10%)", notes: "Demo rate data." },
    { id: "rate-bc-sec-2024", jurisdiction: "BC", leaseType: "residential", depositType: "security_deposit", annualRateBps: 200, effectiveFrom: "2024-01-01", effectiveTo: "2024-12-31", source: "BC deposit interest policy (demo) 2.00%", notes: "Demo rate data." },
    { id: "rate-bc-sec-2025", jurisdiction: "BC", leaseType: "residential", depositType: "security_deposit", annualRateBps: 195, effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", source: "BC deposit interest policy (demo) 1.95%", notes: "Demo rate data." },
    { id: "rate-bc-sec-2026", jurisdiction: "BC", leaseType: "residential", depositType: "security_deposit", annualRateBps: 185, effectiveFrom: "2026-01-01", effectiveTo: null, source: "BC deposit interest policy (demo) 1.85%", notes: "Demo rate data." },
  ];

  /* --------------------------------- Invoices --------------------------------- */
  const invoiceRows: (typeof schema.rentInvoices.$inferInsert)[] = [];
  const addInvoice = (
    lease: (typeof leaseRows)[number],
    offsetMonths: number,
    status: string,
    settlementRef: string | null,
    periodOverride?: { start: string; end: string; label: string },
  ) => {
    const start = periodOverride?.start ?? startOfMonthISO(m(offsetMonths));
    const end = periodOverride?.end ?? endOfMonthISO(start);
    invoiceRows.push({
      id: `inv-${lease.id}-${start}`,
      reference: `INV-${lease.reference.slice(-4)}-${start.slice(0, 7)}`,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      periodLabel: periodOverride?.label ?? start.slice(0, 7),
      periodStart: start,
      periodEnd: end,
      amountCents: lease.monthlyRentCents,
      dueDate: start,
      status,
      settlementRef,
    });
  };
  for (const lease of leaseRows) {
    addInvoice(lease, -3, "settled", null);
    addInvoice(lease, -2, "settled", null);
    addInvoice(lease, -1, lease.status === "ended" ? "open" : "settled", null);
    addInvoice(lease, 0, "open", null);
  }
  const finalLeaseL1 = leaseRows[0];
  const finalStartL1 = startOfMonthISO(finalLeaseL1.endDate);
  addInvoice(finalLeaseL1, 1, "open", null, { start: finalStartL1, end: finalLeaseL1.endDate, label: `${finalStartL1.slice(0, 7)} (final)` });
  const finalLeaseL2 = leaseRows[1];
  const finalStartL2 = startOfMonthISO(finalLeaseL2.endDate);
  addInvoice(finalLeaseL2, -1, "settled_by_deposit", "DTR final period settlement", { start: finalStartL2, end: finalLeaseL2.endDate, label: `${finalStartL2.slice(0, 7)} (final)` });

  /* ------------------------------ Deposit records ------------------------------ */
  const depositRows: (typeof schema.deposits.$inferInsert)[] = [];
  const txnRows: TxnDraft[] = [];
  const journalRows: JournalDraft[] = [];
  const lineRows: LineDraft[] = [];
  const paymentRows: PaymentDraft[] = [];
  const refundRows: (typeof schema.depositRefunds.$inferInsert)[] = [];
  const deviceRows: (typeof schema.keyDevices.$inferInsert)[] = [];
  const auditRows: (typeof schema.auditLog.$inferInsert)[] = [];

  let txnSeq = 0;
  let jeSeq = 0;
  let paySeq = 0;
  let auditSeq = 0;
  const allRates: RateLike[] = rateRows.map((r) => ({
    id: r.id,
    annualRateBps: r.annualRateBps,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    source: r.source,
  }));

  type TxnOptions = {
    type: string;
    classification: "principal" | "interest" | "none";
    signedAmount: number;
    date: string;
    payment?: { method: string; direction: "in" | "out"; type: string; reference?: string };
    journal?: { debit: string; credit: string; description: string; omit?: boolean };
    purpose?: string;
    invoiceId?: string;
    refundId?: string;
    notes?: string;
    documentRef?: string;
    periodStart?: string;
    periodEnd?: string;
    rateBps?: number;
    relatedTxnId?: string;
  };

  const addTxn = (deposit: DepositSeed, opts: TxnOptions): TxnDraft => {
    txnSeq += 1;
    const id = `dtx-${String(txnSeq).padStart(3, "0")}`;
    const reference = `DTR-${today.slice(0, 4)}-${String(txnSeq).padStart(4, "0")}`;
    let paymentId: string | null = null;
    if (opts.payment && Math.abs(opts.signedAmount) > 0) {
      paySeq += 1;
      paymentId = `pay-${String(paySeq).padStart(3, "0")}`;
      paymentRows.push({
        id: paymentId,
        reference: opts.payment.reference ?? `PMT-${today.slice(0, 4)}-${String(paySeq).padStart(4, "0")}`,
        tenantId: deposit.tenantId,
        leaseId: deposit.leaseId,
        type: opts.payment.type,
        direction: opts.payment.direction,
        amountCents: Math.abs(opts.signedAmount),
        method: opts.payment.method,
        receivedAt: opts.date,
        referenceNote: undefined,
        status: "cleared",
        simulated: true,
        createdBy: "staff-manager",
        notes: "Demo record — simulated movement only. No real funds transferred.",
      });
    }
    let journalEntryId: string | null = null;
    if (opts.journal && !opts.journal.omit && Math.abs(opts.signedAmount) > 0) {
      jeSeq += 1;
      journalEntryId = `je-${String(jeSeq).padStart(3, "0")}`;
      journalRows.push({
        id: journalEntryId,
        reference: `JE-${today.slice(0, 4)}-${String(jeSeq).padStart(4, "0")}`,
        entryDate: opts.date,
        description: opts.journal.description,
        sourceType: opts.type === "collection" ? "deposit_collection" : opts.type === "application" ? "deposit_application" : opts.type === "refund_payment" ? "deposit_refund" : opts.type,
        sourceId: id,
        status: "posted",
        simulated: true,
        createdBy: "staff-manager",
      });
      lineRows.push(
        { id: `${journalEntryId}-1`, entryId: journalEntryId, accountCode: opts.journal.debit, debitCents: Math.abs(opts.signedAmount), creditCents: 0, memo: "Demo posting", depositId: deposit.id },
        { id: `${journalEntryId}-2`, entryId: journalEntryId, accountCode: opts.journal.credit, debitCents: 0, creditCents: Math.abs(opts.signedAmount), memo: "Demo posting", depositId: deposit.id },
      );
    }
    const txn: TxnDraft = {
      id,
      reference,
      depositId: deposit.id,
      txnType: opts.type,
      classification: opts.classification,
      signedAmountCents: opts.signedAmount,
      occurredAt: opts.date,
      paymentId,
      invoiceId: opts.invoiceId ?? null,
      refundId: opts.refundId ?? null,
      journalEntryId,
      userId: "staff-manager",
      notes: opts.notes ?? "Demo transaction.",
      documentRef: opts.documentRef ?? null,
      purpose: opts.purpose ?? null,
      relatedTxnId: opts.relatedTxnId ?? null,
      periodStart: opts.periodStart ?? null,
      periodEnd: opts.periodEnd ?? null,
      rateBps: opts.rateBps ?? null,
      status: "posted",
      source: "seed",
      createdAt: new Date(`${opts.date}T15:00:00.000Z`),
    };
    txnRows.push(txn);
    return txn;
  };

  type DepositSeed = typeof schema.deposits.$inferInsert;

  const pushDeposit = (row: DepositSeed): DepositSeed => {
    depositRows.push(row);
    return row;
  };

  const baseDeposit = (
    lease: (typeof leaseRows)[number],
    rows: Partial<typeof schema.deposits.$inferInsert> &
      Pick<
        typeof schema.deposits.$inferInsert,
        "id" | "reference" | "depositType" | "status" | "requiredAmountCents" | "expectedDate"
      >,
  ): DepositSeed => ({
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    leaseId: lease.id,
    jurisdiction: lease.jurisdiction,
    leaseType: lease.leaseType,
    liabilityAccountCode: "2200",
    cashAccountCode: "1020",
    receivableAccountCode: "1200",
    interestPayableAccountCode: "2310",
    responsibleUserId: "staff-manager",
    source: "seed" as const,
    createdBy: "staff-manager",
    documents: [{ name: "Signed lease agreement.pdf", kind: "lease" }],
    ruleSnapshot: {},
    ...rows,
  }) as DepositSeed;

  /* D1 — Last month's rent, held with unposted interest */
  const l1 = leaseRows[0];
  const d1 = pushDeposit(baseDeposit(l1, {
    id: "dep-001", reference: "DEP-2026-0001", depositType: "last_month_rent", status: "held",
    requiredAmountCents: 245000, expectedDate: m(-23), firstReceivedDate: d(-330),
    interestApplicable: true, notes: "LMR held for final rental period. Tenant served notice.",
    reconciliationStatus: "reconciled", lastReconciledAt: new Date(),
    documents: [{ name: "Signed lease agreement.pdf", kind: "lease" }, { name: "Deposit receipt 2024-0188.pdf", kind: "receipt" }],
    createdAt: new Date(`${d(-330)}T14:00:00Z`),
  }));
  addTxn(d1, {
    type: "collection", classification: "principal", signedAmount: 245000, date: d(-330),
    payment: { method: "eft", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2200", description: "LMR deposit collection DEP-2026-0001" },
    documentRef: "Receipt R-10442", notes: "Initial full collection by EFT (simulated).",
  });
  const d1AccrualPeriod = { start: d(-330), end: d(-30) };
  const d1Preview = calculateInterest({
    periodStart: d1AccrualPeriod.start, periodEnd: d1AccrualPeriod.end,
    principalEvents: [{ date: d(-330), signedAmountCents: 245000 }], rates: allRates,
  });
  addTxn(d1, {
    type: "interest_accrual", classification: "interest", signedAmount: d1Preview.totalCents, date: d1AccrualPeriod.end,
    journal: { debit: "6100", credit: "2310", description: "Interest accrual DEP-2026-0001" },
    periodStart: d1AccrualPeriod.start, periodEnd: d1AccrualPeriod.end, rateBps: d1Preview.blendedRateBps,
    notes: "Annual statutory interest accrual on held principal (effective-dated rate).",
  });

  /* D2 — LMR applied to the final rental period */
  const l2 = leaseRows[1];
  const d2 = pushDeposit(baseDeposit(l2, {
    id: "dep-002", reference: "DEP-2026-0002", depositType: "last_month_rent", status: "applied",
    requiredAmountCents: 215000, expectedDate: m(-20), firstReceivedDate: d(-600),
    interestApplicable: true, notes: "Applied to the final rental period on termination.",
    reconciliationStatus: "reconciled", lastReconciledAt: new Date(),
    createdAt: new Date(`${d(-600)}T15:30:00Z`),
  }));
  addTxn(d2, {
    type: "collection", classification: "principal", signedAmount: 215000, date: d(-600),
    payment: { method: "cheque", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2200", description: "LMR deposit collection DEP-2026-0002" },
  });
  const d2Invoice = invoiceRows.find((i) => i.leaseId === l2.id && i.status === "settled_by_deposit");
  addTxn(d2, {
    type: "application", classification: "principal", signedAmount: -215000, date: d(-25),
    journal: { debit: "2200", credit: "1200", description: "LMR applied to final rental period invoice" },
    invoiceId: d2Invoice?.id, purpose: "final_rental_period",
    notes: "Applied to the final rental period invoice. No rental income recognised twice.",
  });

  /* D3 — Key deposit held with a partially returned device set */
  const d3 = pushDeposit(baseDeposit(l1, {
    id: "dep-003", reference: "DEP-2026-0003", depositType: "key_fob", status: "held",
    requiredAmountCents: 15000, expectedDate: m(-23), firstReceivedDate: d(-300),
    interestApplicable: false, liabilityAccountCode: "2210",
    notes: "Two keys issued at move-in. One returned; one still outstanding.",
    reconciliationStatus: "reconciled", lastReconciledAt: new Date(),
    documents: [{ name: "Key register 1204.pdf", kind: "device register" }],
  }));
  addTxn(d3, {
    type: "collection", classification: "principal", signedAmount: 15000, date: d(-300),
    payment: { method: "etransfer", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2210", description: "Key deposit collection DEP-2026-0003" },
    documentRef: "Key register 1204",
  });
  addTxn(d3, {
    type: "adjustment", classification: "principal", signedAmount: 0, date: d(-300),
    notes: "Device register recorded: 2 keys at $75.00 replacement cost each.",
  });
  deviceRows.push(
    { id: "dev-001", depositId: d3.id, deviceType: "key", identifier: "KEY-A-1204-1", quantityIssued: 1, quantityReturned: 1, replacementCostCents: 7500, returnDate: d(-20), returnCondition: "good", notes: "Returned at inspection." },
    { id: "dev-002", depositId: d3.id, deviceType: "fob", identifier: "FOB-1204-2", quantityIssued: 1, quantityReturned: 0, replacementCostCents: 7500, returnDate: null, returnCondition: "not_returned", notes: "Outstanding at move-out — replacement cost documentation on file." },
  );

  /* D4 — Key deposit refunded and closed */
  const d4 = pushDeposit(baseDeposit(l2, {
    id: "dep-004", reference: "DEP-2026-0004", depositType: "key_fob", status: "refunded",
    requiredAmountCents: 10000, expectedDate: m(-20), firstReceivedDate: d(-500),
    interestApplicable: false, liabilityAccountCode: "2210",
    notes: "Access fob returned; deposit refunded in full.", reconciliationStatus: "reconciled",
    lastReconciledAt: new Date(),
  }));
  addTxn(d4, {
    type: "collection", classification: "principal", signedAmount: 10000, date: d(-500),
    payment: { method: "cash", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2210", description: "Key deposit collection DEP-2026-0004" },
  });
  refundRows.push({
    id: "rfd-001", reference: "RFS-2026-0001", depositId: d4.id, requestedAt: d(-40),
    requestedPrincipalCents: 10000, requestedInterestCents: 0, approvedPrincipalCents: 10000, approvedInterestCents: 0,
    method: "etransfer", status: "completed", dueDate: d(-25), approvalStatus: "not_required",
    requestedBy: "staff-manager", approvedBy: "staff-controller", approvedAt: new Date(`${d(-35)}T16:00:00Z`),
    paymentId: null, completedAt: new Date(`${d(-20)}T17:00:00Z`), notes: "Fob returned in good condition.",
    documentRef: "Fob return receipt", source: "seed",
  });
  addTxn(d4, {
    type: "refund_request", classification: "none", signedAmount: 0, date: d(-40), refundId: "rfd-001",
    notes: "Refund requested after device return.",
  });
  addTxn(d4, {
    type: "refund_payment", classification: "principal", signedAmount: -10000, date: d(-20), refundId: "rfd-001",
    payment: { method: "etransfer", direction: "out", type: "deposit_refund" },
    journal: { debit: "2210", credit: "1020", description: "Key deposit refund DEP-2026-0004" },
    documentRef: "RFS-2026-0001", notes: "Simulated refund — no real transfer.",
  });
  deviceRows.push({ id: "dev-003", depositId: d4.id, deviceType: "fob", identifier: "FOB-805-1", quantityIssued: 1, quantityReturned: 1, replacementCostCents: 10000, returnDate: d(-40), returnCondition: "good", notes: "Returned." });

  /* D5 — Expected LMR not received (overdue) */
  const l3 = leaseRows[2];
  pushDeposit(baseDeposit(l3, {
    id: "dep-005", reference: "DEP-2026-0005", depositType: "last_month_rent", status: "expected",
    requiredAmountCents: 185000, expectedDate: d(-25), firstReceivedDate: null,
    interestApplicable: true, notes: "Move-in collection not received. Follow up with tenant.",
    reconciliationStatus: "not_reviewed", documents: [{ name: "Deposit requirement notice.pdf", kind: "notice" }],
  }));

  /* D6 — Partially received LMR */
  const l5 = leaseRows[4];
  const d6 = pushDeposit(baseDeposit(l5, {
    id: "dep-006", reference: "DEP-2026-0006", depositType: "last_month_rent", status: "partially_received",
    requiredAmountCents: 195000, expectedDate: m(-1), firstReceivedDate: d(-5),
    interestApplicable: true, notes: "Partial payment received on move-in; balance promised next pay period.",
    reconciliationStatus: "not_reviewed",
  }));
  addTxn(d6, {
    type: "partial_collection", classification: "principal", signedAmount: 100000, date: d(-5),
    payment: { method: "etransfer", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2200", description: "Partial LMR collection DEP-2026-0006" },
    notes: "Partial collection — $950.00 remains expected.", documentRef: "Receipt R-11021",
  });

  /* D7 — Commercial security deposit with refund awaiting approval */
  const l10 = leaseRows[9];
  const d7 = pushDeposit(baseDeposit(l10, {
    id: "dep-007", reference: "DEP-2026-0007", depositType: "security_deposit", status: "refund_requested",
    requiredAmountCents: 500000, expectedDate: m(-24), firstReceivedDate: d(-700),
    interestApplicable: false, liabilityAccountCode: "2220",
    notes: "Commercial security deposit. Refund requested following lease amendment.",
    reconciliationStatus: "not_reviewed",
    documents: [{ name: "Commercial lease Article 12.pdf", kind: "lease" }, { name: "Amendment 2.pdf", kind: "amendment" }],
  }));
  addTxn(d7, {
    type: "collection", classification: "principal", signedAmount: 500000, date: d(-700),
    payment: { method: "eft", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2220", description: "Commercial security deposit DEP-2026-0007" },
  });
  refundRows.push({
    id: "rfd-002", reference: "RFS-2026-0002", depositId: d7.id, requestedAt: d(-3),
    requestedPrincipalCents: 500000, requestedInterestCents: 0, approvedPrincipalCents: null, approvedInterestCents: null,
    method: "eft", status: "requested", dueDate: d(12), approvalStatus: "pending",
    requestedBy: "staff-manager", approvedBy: null, approvedAt: null, paymentId: null, completedAt: null,
    notes: "Refund requested under lease amendment. Requires controller approval.", documentRef: "Amendment 2.pdf", source: "seed",
  });
  addTxn(d7, {
    type: "refund_request", classification: "none", signedAmount: 0, date: d(-3), refundId: "rfd-002",
    notes: "Commercial security deposit refund requested — pending approval.",
  });

  /* D8 — Commercial security deposit with a missing accounting entry (reconciliation exception) */
  const l6 = leaseRows[5];
  const d8 = pushDeposit(baseDeposit(l6, {
    id: "dep-008", reference: "DEP-2026-0008", depositType: "security_deposit", status: "held",
    requiredAmountCents: 800000, expectedDate: m(-14), firstReceivedDate: d(-400),
    interestApplicable: false, liabilityAccountCode: "2220",
    notes: "Trust transfer not yet journalised — reconciliation exception open.",
    reconciliationStatus: "exception",
  }));
  addTxn(d8, {
    type: "collection", classification: "principal", signedAmount: 800000, date: d(-400),
    payment: { method: "eft", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2220", description: "Security deposit collection DEP-2026-0008", omit: true },
    notes: "Collection recorded; accounting entry intentionally missing (demo reconciliation difference).",
  });
  addTxn(d8, {
    type: "adjustment", classification: "principal", signedAmount: 0, date: d(-399),
    notes: "Deposit terms confirmed in commercial lease schedule B.",
  });

  /* D9 — BC security deposit with interest and an approved refund awaiting payment */
  const l9 = leaseRows[8];
  const d9 = pushDeposit(baseDeposit(l9, {
    id: "dep-009", reference: "DEP-2026-0009", depositType: "security_deposit", status: "refund_pending",
    requiredAmountCents: 99000, expectedDate: m(-18), firstReceivedDate: d(-540),
    interestApplicable: true, liabilityAccountCode: "2220",
    notes: "Tenancy ended; refund with statutory interest approved and awaiting payment.",
    reconciliationStatus: "under_review",
  }));
  addTxn(d9, {
    type: "collection", classification: "principal", signedAmount: 99000, date: d(-540),
    payment: { method: "eft", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2220", description: "BC security deposit collection DEP-2026-0009" },
  });
  const d9Preview = calculateInterest({
    periodStart: d(-540), periodEnd: d(-60),
    principalEvents: [{ date: d(-540), signedAmountCents: 99000 }], rates: allRates,
  });
  addTxn(d9, {
    type: "interest_accrual", classification: "interest", signedAmount: d9Preview.totalCents, date: d(-60),
    journal: { debit: "6100", credit: "2310", description: "Interest accrual DEP-2026-0009" },
    periodStart: d(-540), periodEnd: d(-60), rateBps: d9Preview.blendedRateBps,
    notes: "Interest accrued under effective-dated BC policy rates.",
  });
  refundRows.push({
    id: "rfd-003", reference: "RFS-2026-0003", depositId: d9.id, requestedAt: d(-30),
    requestedPrincipalCents: 99000, requestedInterestCents: d9Preview.totalCents,
    approvedPrincipalCents: 99000, approvedInterestCents: d9Preview.totalCents,
    method: "eft", status: "approved", dueDate: d(5), approvalStatus: "approved",
    requestedBy: "staff-manager", approvedBy: "staff-controller", approvedAt: new Date(`${d(-10)}T18:00:00Z`),
    paymentId: null, completedAt: null, notes: "Approved with interest after condition inspection.",
    documentRef: "Condition report PM-04.pdf", source: "seed",
  });
  addTxn(d9, {
    type: "refund_request", classification: "none", signedAmount: 0, date: d(-30), refundId: "rfd-003",
    notes: "Refund requested including outstanding interest.",
  });

  /* D10 — Legacy key deposit evaluated under a superseded rule version */
  const l4 = leaseRows[3];
  pushDeposit(baseDeposit(l4, {
    id: "dep-010", reference: "DEP-2026-0010", depositType: "key_fob", status: "held",
    requiredAmountCents: 10000, expectedDate: m(-35), firstReceivedDate: d(-800),
    interestApplicable: false, liabilityAccountCode: "2210",
    notes: "Collected in 2023 under the legacy $100 key deposit policy. Two keys outstanding.",
    reconciliationStatus: "reconciled", lastReconciledAt: new Date(),
    ruleSnapshot: { ruleId: "rule-on-res-key-2023", legalReference: "Former Ontario key deposit policy", effectiveFrom: "2023-01-01", capturedAt: d(-800) },
  }));
  const d10 = depositRows[depositRows.length - 1];
  addTxn(d10, {
    type: "collection", classification: "principal", signedAmount: 10000, date: d(-800),
    payment: { method: "cash", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2210", description: "Legacy key deposit collection DEP-2026-0010" },
  });
  deviceRows.push({ id: "dev-004", depositId: d10.id, deviceType: "key", identifier: "KEY-CG07-A", quantityIssued: 1, quantityReturned: 0, replacementCostCents: 5000, returnDate: null, returnCondition: "not_returned", notes: "Original key set outstanding." });
  deviceRows.push({ id: "dev-005", depositId: d10.id, deviceType: "key", identifier: "KEY-CG07-B", quantityIssued: 1, quantityReturned: 0, replacementCostCents: 5000, returnDate: null, returnCondition: "not_returned", notes: "Duplicate key outstanding." });

  /* D11 — Cancelled draft */
  const l7 = leaseRows[6];
  pushDeposit(baseDeposit(l7, {
    id: "dep-011", reference: "DEP-2026-0011", depositType: "last_month_rent", status: "cancelled",
    requiredAmountCents: 615000, expectedDate: m(-3), firstReceivedDate: null, interestApplicable: false,
    notes: "Cancelled — lease addendum removed the prepaid rent requirement.",
    cancellationReason: "Lease addendum 1 removed the prepaid rent requirement.", cancelledAt: d(-80),
    reconciliationStatus: "not_reviewed", documents: [],
  }));

  /* D12 — Draft key deposit awaiting configuration review */
  pushDeposit(baseDeposit(l3, {
    id: "dep-012", reference: "DEP-2026-0012", depositType: "key_fob", status: "draft",
    requiredAmountCents: 12000, expectedDate: d(10), firstReceivedDate: null, interestApplicable: false,
    liabilityAccountCode: "2210", notes: "Draft — awaiting replacement-cost documentation from site team.",
    reconciliationStatus: "not_reviewed", documents: [{ name: "Pending device quotation.pdf", kind: "quote" }],
  }));

  /* D13 — LMR with annual interest credited against a rent increase */
  const d13 = pushDeposit(baseDeposit(l4, {
    id: "dep-013", reference: "DEP-2026-0013", depositType: "last_month_rent", status: "held",
    requiredAmountCents: 172000, expectedDate: m(-35), firstReceivedDate: d(-1000),
    interestApplicable: true, notes: "Interest credited against the 2026 lawful rent increase; not double-counted.",
    reconciliationStatus: "reconciled", lastReconciledAt: new Date(),
  }));
  addTxn(d13, {
    type: "collection", classification: "principal", signedAmount: 172000, date: d(-1000),
    payment: { method: "eft", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2200", description: "LMR deposit collection DEP-2026-0013" },
  });
  const d13Preview = calculateInterest({
    periodStart: d(-365), periodEnd: d(-30),
    principalEvents: [{ date: d(-365), signedAmountCents: 172000 }], rates: allRates,
  });
  const d13Credit = roundHalfUp(172000 * 0.021);
  addTxn(d13, {
    type: "interest_accrual", classification: "interest", signedAmount: d13Preview.totalCents, date: d(-30),
    journal: { debit: "6100", credit: "2310", description: "Interest accrual DEP-2026-0013" },
    periodStart: d(-365), periodEnd: d(-30), rateBps: d13Preview.blendedRateBps,
    notes: "Accrued for the 2026 interest period.",
  });
  addTxn(d13, {
    type: "interest_credit", classification: "interest", signedAmount: -Math.min(d13Preview.totalCents, d13Credit), date: d(-29),
    journal: { debit: "2310", credit: "1200", description: "Interest credited against rent increase DEP-2026-0013" },
    invoiceId: invoiceRows.find((i) => i.leaseId === l4.id && i.status === "open")?.id,
    notes: "Interest credited against the lawful 2.1% rent increase — single credit, no double counting.",
  });

  /* D14 — Ontario residential "damage deposit" held under legacy practice (review required) */
  const d14 = pushDeposit(baseDeposit(l3, {
    id: "dep-014", reference: "DEP-2026-0014", depositType: "security_deposit", status: "held",
    requiredAmountCents: 50000, expectedDate: m(-8), firstReceivedDate: d(-200),
    interestApplicable: false, liabilityAccountCode: "2220",
    notes: "Legacy security deposit collected outside the permitted Ontario residential workflow. Compliance review required.",
    reconciliationStatus: "exception",
    documents: [{ name: "Legacy receipt scan.pdf", kind: "receipt" }],
  }));
  addTxn(d14, {
    type: "collection", classification: "principal", signedAmount: 50000, date: d(-200),
    payment: { method: "cheque", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2220", description: "Legacy security deposit DEP-2026-0014", omit: true },
    notes: "Held funds under a prohibited residential category — review required. Accounting entry not posted.",
  });

  /* D15 — Expected key deposit due soon */
  const l8 = leaseRows[7];
  pushDeposit(baseDeposit(l8, {
    id: "dep-015", reference: "DEP-2026-0015", depositType: "key_fob", status: "expected",
    requiredAmountCents: 8000, expectedDate: d(3), firstReceivedDate: null, interestApplicable: false,
    liabilityAccountCode: "2210", notes: "Two access cards to be issued at move-in.",
    reconciliationStatus: "not_reviewed", documents: [],
  }));
  deviceRows.push({ id: "dev-006", depositId: "dep-015", deviceType: "access_card", identifier: "CARD-PM04-1", quantityIssued: 2, quantityReturned: 0, replacementCostCents: 4000, returnDate: null, returnCondition: null, notes: "To be issued at move-in." });

  /* D16 — Commercial utility deposit held */
  const d16 = pushDeposit(baseDeposit(l7, {
    id: "dep-016", reference: "DEP-2026-0016", depositType: "utility_deposit", status: "held",
    requiredAmountCents: 120000, expectedDate: m(-10), firstReceivedDate: d(-300),
    interestApplicable: false, liabilityAccountCode: "2230",
    notes: "Utility deposit per Alberta commercial lease schedule C.", reconciliationStatus: "not_reviewed",
  }));
  addTxn(d16, {
    type: "collection", classification: "principal", signedAmount: 120000, date: d(-300),
    payment: { method: "eft", direction: "in", type: "deposit" },
    journal: { debit: "1020", credit: "2230", description: "Utility deposit collection DEP-2026-0016" },
    notes: "Commercial utility deposit received.",
  });

  /* ------------------------------ Reconciliations ------------------------------ */
  const reconRows: (typeof schema.reconciliationItems.$inferInsert)[] = [
    {
      id: "rec-001", reference: "REC-2026-0001", depositId: d8.id, depositReference: d8.reference,
      txnRef: "DTR-2026-0008", accountingRef: "Not posted", txnDate: d(-400), amountCents: 800000, differenceCents: 800000,
      source: "gl", reason: "Collection posted to the deposit subledger, but no journal entry exists for the trust transfer.",
      reviewerId: null, status: "open", resolutionNotes: null,
    },
    {
      id: "rec-002", reference: "REC-2026-0002", depositId: d9.id, depositReference: d9.reference,
      txnRef: "DTR-2026-0010", accountingRef: "JE-2026-0009", txnDate: d(-60), amountCents: d9Preview.totalCents,
      differenceCents: 420, source: "subledger",
      reason: "Interest payable in the general ledger differs from the subledger by $4.20 (manual GL accrual).",
      reviewerId: "staff-controller", status: "under_review", resolutionNotes: "Controller reviewing the manual accrual for correction.",
    },
    {
      id: "rec-003", reference: "REC-2026-0003", depositId: d14.id, depositReference: d14.reference,
      txnRef: "DTR-2026-0014", accountingRef: "Not posted", txnDate: d(-200), amountCents: 50000, differenceCents: 50000,
      source: "gl", reason: "Legacy security deposit received under a prohibited residential category with no accounting mapping.",
      reviewerId: null, status: "correction_required", resolutionNotes: "Requires legal review and controlled reclassification once resolved.",
    },
    {
      id: "rec-004", reference: "REC-2026-0004", depositId: d7.id, depositReference: d7.reference,
      txnRef: "DTR-2026-0006", accountingRef: "Pending payment", txnDate: d(-3), amountCents: 500000, differenceCents: 0,
      source: "bank", reason: "Approved refund still outstanding — no bank movement yet. Legitimate subledger/bank timing difference.",
      reviewerId: "staff-controller", status: "under_review", resolutionNotes: "Tracked against refund RFS-2026-0002.",
    },
    {
      id: "rec-005", reference: "REC-2026-0005", depositId: d1.id, depositReference: d1.reference,
      txnRef: "DTR-2026-0001", accountingRef: "JE-2026-0001", txnDate: d(-330), amountCents: 245000, differenceCents: 0,
      source: "bank", reason: "Deposit cleared in the subsequent bank statement — timing only.",
      reviewerId: "staff-controller", status: "resolved", resolutionNotes: "Cleared in following statement; no adjustment required.",
    },
  ];

  /* --------------------------------- Audit log --------------------------------- */
  const pushAudit = (entityId: string, action: string, date: string, newValue: Record<string, unknown>, userId = "staff-manager", reason?: string) => {
    auditSeq += 1;
    auditRows.push({
      id: `aud-${String(auditSeq).padStart(3, "0")}`,
      entityType: "deposit",
      entityId,
      action,
      userId,
      previousValue: null,
      newValue,
      reason: reason ?? null,
      approvalRef: null,
      relatedRef: null,
      createdAt: new Date(`${date}T16:00:00Z`),
    });
  };
  pushAudit(d1.id, "Deposit created", m(-23), { reference: d1.reference, requiredAmountCents: 245000 });
  pushAudit(d1.id, "Collection recorded (simulated)", d(-330), { amountCents: 245000, method: "eft" });
  pushAudit(d1.id, "Interest accrued", d(-30), { amountCents: d1Preview.totalCents, rateBps: d1Preview.blendedRateBps });
  pushAudit(d2.id, "Deposit applied — final_rental_period", d(-25), { amountCents: 215000, invoice: d2Invoice?.reference }, "staff-manager", "Final rental period settled from LMR.");
  pushAudit(d4.id, "Refund processed (simulated)", d(-20), { reference: "RFS-2026-0001", amountCents: 10000 });
  pushAudit(d7.id, "Refund requested", d(-3), { reference: "RFS-2026-0002", amountCents: 500000 });
  pushAudit(d9.id, "Refund approved", d(-10), { reference: "RFS-2026-0003", principal: 99000, interest: d9Preview.totalCents }, "staff-controller");
  pushAudit(d14.id, "Compliance review flagged", d(-190), { reason: "Prohibited residential deposit category" }, "staff-controller", "Legacy practice under review.");
  pushAudit(d10.id, "Legacy rule version evaluated", d(-800), { ruleId: "rule-on-res-key-2023", maxAmountCents: 10000 });

  /* ---------------------------------- Insert ---------------------------------- */
  await db.transaction(async (tx) => {
    await tx.insert(schema.appMeta).values([
      { key: "seed_version", value: SEED_VERSION },
      { key: "seed_created_at", value: new Date().toISOString() },
      { key: "bank_opening_cents", value: "7500000" },
      { key: "org_name", value: "Meridian Property Group" },
    ]).onConflictDoUpdate({ target: schema.appMeta.key, set: { value: SEED_VERSION } });

    await tx.insert(schema.staff).values(staffRows).onConflictDoNothing();
    await tx.insert(schema.properties).values(propertyRows).onConflictDoNothing();
    await tx.insert(schema.units).values(unitRows).onConflictDoNothing();
    await tx.insert(schema.tenants).values(tenantRows).onConflictDoNothing();
    await tx.insert(schema.leases).values(leaseRows).onConflictDoNothing();
    await tx.insert(schema.chartOfAccounts).values(accountRows).onConflictDoNothing();
    await tx.insert(schema.depositRules).values(ruleRows).onConflictDoNothing();
    await tx.insert(schema.depositInterestRates).values(rateRows).onConflictDoNothing();
    await tx.insert(schema.rentInvoices).values(invoiceRows).onConflictDoNothing();
    await tx.insert(schema.deposits).values(depositRows).onConflictDoNothing();
    if (paymentRows.length) await tx.insert(schema.payments).values(paymentRows).onConflictDoNothing();
    if (txnRows.length) await tx.insert(schema.depositTransactions).values(txnRows).onConflictDoNothing();
    if (journalRows.length) await tx.insert(schema.journalEntries).values(journalRows).onConflictDoNothing();
    if (lineRows.length) await tx.insert(schema.journalLines).values(lineRows).onConflictDoNothing();
    if (refundRows.length) await tx.insert(schema.depositRefunds).values(refundRows).onConflictDoNothing();
    if (deviceRows.length) await tx.insert(schema.keyDevices).values(deviceRows).onConflictDoNothing();
    await tx.insert(schema.reconciliationItems).values(reconRows).onConflictDoNothing();
    if (auditRows.length) await tx.insert(schema.auditLog).values(auditRows).onConflictDoNothing();

    // Link completed refunds to their simulated payment rows.
    const refundPayment = paymentRows.find((p) => p.type === "deposit_refund" && p.amountCents === 10000);
    if (refundPayment) {
      await tx.update(schema.depositRefunds).set({ paymentId: refundPayment.id }).where(eqRef("rfd-001"));
    }
  });
}

function eqRef(id: string) {
  return eq(schema.depositRefunds.id, id);
}
