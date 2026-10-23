import { isSupabaseConfigured } from "../../../lib/supabase";

/** "Today" for the reports: the real date with Supabase, a fixed date for the sample data. */
export const APP_TODAY = isSupabaseConfigured ? new Date().toISOString().slice(0, 10) : "2026-03-15";

export const COMPANY = {
  name: isSupabaseConfigured ? "Your organization" : "Northshore Property Group",
  legalName: isSupabaseConfigured ? "" : "Northshore Property Group Inc.",
  address: isSupabaseConfigured ? "" : "100 King Street West, Suite 2400, Toronto, ON M5X 1A9",
  currency: "CAD" as const,
  fiscalYearStartMonth: 1,
};

/**
 * Accounts the report engine looks up directly. The sample chart uses these codes as ids; with Supabase they are resolved to the
 * organization's real accounts when the books are loaded (./live.ts).
 */
export const SYS = {
  cash: "1020",
  trust: "1030",
  securityDeposits: "2100",
  rent: "4000",
  otherRental: "4110",
  propertyTax: "5300",
  interest: "6000",
  bankCharges: "6200",
};
