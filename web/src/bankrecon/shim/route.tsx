// Hash-route plumbing that replaces next/link and next/navigation: original app paths become query params of #/bank-reconciliation.
import { createContext, useContext, useMemo } from "react";

export interface ReconRoute {
  tab: string;
  ws: string; // open reconciliation workspace (bank account id)
  detail: string; // open history detail drawer (reconciliation id)
  query: Record<string, string>; // other params, e.g. account for the imports tab
}

export const TAB_IDS = ["dashboard", "matching", "unmatched", "history", "reports", "imports", "settings"] as const;
const BASE = "/accounting/bank-reconciliation";

export const RouteContext = createContext<ReconRoute>({ tab: "dashboard", ws: "", detail: "", query: {} });

export function routeFromParams(params?: Record<string, string>): ReconRoute {
  const { tab, ws, detail, ...query } = params ?? {};
  return { tab: (TAB_IDS as readonly string[]).includes(tab ?? "") ? (tab as string) : "dashboard", ws: ws ?? "", detail: detail ?? "", query };
}

export function buildHash(r: Partial<ReconRoute> & { tab: string }) {
  const q = new URLSearchParams();
  q.set("tab", r.tab);
  if (r.ws) q.set("ws", r.ws);
  if (r.detail) q.set("detail", r.detail);
  for (const [k, v] of Object.entries(r.query ?? {})) if (v) q.set(k, v);
  return `#/bank-reconciliation?${q.toString()}`;
}

/** Maps an original app path (e.g. /accounting/bank-reconciliation/history/R-1) onto a hash route. */
export function toHref(path: string, current: ReconRoute): string {
  const [pathname, search = ""] = path.split("?");
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length).split("/").filter(Boolean) : [];
  const query = Object.fromEntries(new URLSearchParams(search));
  if (rest[0] === "workspace" && rest[1]) return buildHash({ tab: current.tab, ws: rest[1] });
  if (rest[0] === "history" && rest[1]) return buildHash({ tab: "history", detail: rest[1] });
  const tab = rest[0] && (TAB_IDS as readonly string[]).includes(rest[0]) ? rest[0] : "dashboard";
  return buildHash({ tab, query });
}

export const useRoute = () => useContext(RouteContext);

export function useRouter() {
  const route = useRoute();
  return {
    push: (path: string) => { window.location.hash = toHref(path, route); },
    replace: (path: string) => { window.location.hash = toHref(path, route); },
    back: () => window.history.back(),
  };
}

export function useSearchParams() {
  const route = useRoute();
  return useMemo(() => new URLSearchParams(route.query), [route.query]);
}
