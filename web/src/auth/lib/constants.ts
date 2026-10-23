import type { Organization } from "./types";

export const COUNTRIES = [
  "Canada",
  "United States",
  "United Kingdom",
  "Australia",
  "New Zealand",
  "Ireland",
  "Germany",
  "France",
  "Spain",
  "Netherlands",
  "United Arab Emirates",
  "Singapore",
];

export const BUSINESS_TYPES: Organization["businessType"][] = [
  "Individual Landlord",
  "Property Management Company",
  "Real Estate Business",
  "Other",
];

export const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar", symbol: "$" },
  { code: "CAD", label: "CAD — Canadian Dollar", symbol: "$" },
  { code: "GBP", label: "GBP — British Pound", symbol: "£" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "AUD", label: "AUD — Australian Dollar", symbol: "$" },
  { code: "NZD", label: "NZD — New Zealand Dollar", symbol: "$" },
  { code: "AED", label: "AED — UAE Dirham", symbol: "د.إ" },
  { code: "SGD", label: "SGD — Singapore Dollar", symbol: "$" },
];

export const TIMEZONES = [
  { value: "America/Toronto", label: "Eastern Time — Toronto (GMT−4)" },
  { value: "America/New_York", label: "Eastern Time — New York (GMT−4)" },
  { value: "America/Chicago", label: "Central Time — Chicago (GMT−5)" },
  { value: "America/Denver", label: "Mountain Time — Denver (GMT−6)" },
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles (GMT−7)" },
  { value: "America/Vancouver", label: "Pacific Time — Vancouver (GMT−7)" },
  { value: "Europe/London", label: "Greenwich Mean Time — London (GMT+1)" },
  { value: "Europe/Dublin", label: "Greenwich Mean Time — Dublin (GMT+1)" },
  { value: "Europe/Paris", label: "Central European Time — Paris (GMT+2)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time — Dubai (GMT+4)" },
  { value: "Asia/Singapore", label: "Singapore Time — Singapore (GMT+8)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time — Sydney (GMT+10)" },
  { value: "Pacific/Auckland", label: "New Zealand Time — Auckland (GMT+12)" },
];

export const PASSWORD_REQUIREMENTS = [
  { key: "length", label: "At least 8 characters" },
  { key: "upper", label: "One uppercase letter" },
  { key: "lower", label: "One lowercase letter" },
  { key: "number", label: "One number" },
  { key: "special", label: "One special character" },
] as const;

