// Tiny stand-in for react-router-dom, built on the host app's #/route?query hashes.
// "/invoices" -> #/invoices, "/invoices/INV-1" -> #/invoices?id=INV-1, and the detail page reads that id back.
import { useCallback, useMemo, useSyncExternalStore, type AnchorHTMLAttributes } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const snapshot = () => window.location.hash;

const parse = (hash: string) => {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  return { path, params: new URLSearchParams(query) };
};

const toHash = (to: string) => {
  const detail = /^\/invoices\/(.+)$/.exec(to);
  return detail ? `#/invoices?id=${encodeURIComponent(detail[1])}` : `#${to}`;
};

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams, opts?: { replace?: boolean }) => void] {
  const hash = useSyncExternalStore(subscribe, snapshot);
  const params = useMemo(() => parse(hash).params, [hash]);
  const set = useCallback((next: URLSearchParams, opts?: { replace?: boolean }) => {
    const query = next.toString();
    const url = `#/${parse(window.location.hash).path}${query ? `?${query}` : ""}`;
    if (opts?.replace) {
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else window.location.hash = url;
  }, []);
  return [params, set];
}

export const useParams = () => ({ id: useSearchParams()[0].get("id") ?? undefined });

export const useNavigate = () => useCallback((to: string) => { window.location.hash = toHash(to); }, []);

export function Link({ to, ...rest }: { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <a href={toHash(to)} {...rest} />;
}
