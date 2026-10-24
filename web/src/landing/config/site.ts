/**
 * Central configuration for the L.O.F.T. marketing page.
 * Routes, navigation and footer links live here so they can be wired to the
 * real application without touching the section components.
 */

export const SITE_NAME = "L.O.F.T.";
export const SITE_TAGLINE = "Property management with the accounting built in.";

/* -------------------------------------------------------------------------- */
/* Authentication routes                                                      */
/* -------------------------------------------------------------------------- */
/** The app is hash-routed: these open its real sign-in and sign-up screens. */
export type AuthRouteKey = "signup" | "login";

export interface AuthRoute {
  href: string;
  /** Human-readable name of the screen. */
  name: string;
}

export const AUTH_ROUTES: Record<AuthRouteKey, AuthRoute> = {
  signup: { href: "#/signup", name: "sign-up" },
  login: { href: "#/login", name: "log-in" },
};

/* -------------------------------------------------------------------------- */
/* Primary navigation                                                         */
/* -------------------------------------------------------------------------- */
/**
 * Pricing is intentionally omitted: no verified plans or prices exist yet, so
 * there is no pricing section to link to. Add it here once one is published.
 */
export const NAV_ITEMS = [
  { label: "Platform", id: "platform" },
  { label: "Accounting", id: "accounting" },
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Security", id: "security" },
] as const;

export const NAV_SECTION_IDS: readonly string[] = NAV_ITEMS.map((item) => item.id);

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */
export interface FooterLink {
  label: string;
  /** Links without an href are not rendered (the page doesn't exist yet). */
  href?: string;
}

export const FOOTER_PRODUCT_LINKS: FooterLink[] = [
  { label: "Platform", href: "#platform" },
  { label: "Properties and Units", href: "#feature-properties" },
  { label: "Accounting", href: "#accounting" },
  { label: "Maintenance and Projects", href: "#feature-maintenance" },
  { label: "Reports", href: "#feature-reports" },
];

export const FOOTER_EXPLORE_LINKS: FooterLink[] = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Teams and Roles", href: "#teams" },
  { label: "Security", href: "#security" },
  { label: "Who It's For", href: "#who-its-for" },
];

/**
 * Company and legal pages have not been published yet. Add an `href` to each
 * entry once the page exists — only entries with an href are displayed.
 */
export const FOOTER_COMPANY_LINKS: FooterLink[] = [{ label: "About" }, { label: "Contact" }];

export const FOOTER_LEGAL_LINKS: FooterLink[] = [{ label: "Privacy Policy" }, { label: "Terms of Service" }];
