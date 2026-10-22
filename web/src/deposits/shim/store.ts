// Stand-ins for the pieces of Next.js the original module relied on: cache revalidation, the current route and server-only helpers.
import { createContext, useContext, useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

/** Everything on screen re-reads the in-memory data after a write (replaces Next's revalidatePath). */
export function bump(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

export function revalidatePath(..._args: unknown[]): void {
  bump();
}

export function useVersion(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => version,
  );
}

export const VIEWS = ["register", "collection", "application", "refunds", "interest", "reconciliation", "reports", "configuration"] as const;

export type DepositsRoute = {
  view: string; // "overview" or one of VIEWS
  dep: string; // deposit id shown in the detail drawer
  isNew: boolean; // create-deposit drawer
  query: Record<string, string>; // the module's own filters (q, status, page, sort, ...)
};

export const RouteContext = createContext<DepositsRoute>({ view: "overview", dep: "", isNew: false, query: {} });
export const useRoute = () => useContext(RouteContext);

export function routeFromParams(params: Record<string, string> | undefined): DepositsRoute {
  const { view, dep, new: isNew, ...query } = params || {};
  return { view: view && (VIEWS as readonly string[]).includes(view) ? view : "overview", dep: dep || "", isNew: isNew === "1", query };
}

export function buildHash(view: string, query: Record<string, string>, extra: { dep?: string; isNew?: boolean } = {}): string {
  const sp = new URLSearchParams();
  if (view && view !== "overview") sp.set("view", view);
  for (const [k, v] of Object.entries(query)) if (v !== "" && v != null) sp.set(k, v);
  if (extra.dep) sp.set("dep", extra.dep);
  if (extra.isNew) sp.set("new", "1");
  const s = sp.toString();
  return `#/deposits${s ? `?${s}` : ""}`;
}

const RECORD_ROUTES: Record<string, string> = { properties: "properties", leases: "leases", payments: "payments", accounts: "accounts", units: "units", tenants: "tenants" };

/** Translates an original Next.js href (/deposits/register?status=held, /deposits/dep-123, /records/payments) into a hash route. */
export function toHref(href: string, route: DepositsRoute): string {
  const url = new URL(href, "http://x");
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "records") return `#/${RECORD_ROUTES[parts[1]] || "dashboard"}`;
  if (parts[0] !== "deposits") return href;
  if (parts.length === 1) return buildHash("overview", query);
  const seg = parts[1];
  if ((VIEWS as readonly string[]).includes(seg)) return buildHash(seg, query);
  if (seg === "new") return buildHash(route.view, route.query, { isNew: true });
  return buildHash(route.view, route.query, { dep: seg });
}

export class NotFoundError extends Error {}
export function notFound(): never {
  throw new NotFoundError("not found");
}
