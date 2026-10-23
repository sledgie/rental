// Minimal hash-router stand-in for react-router-dom. The prototype's "/app/..." paths map onto this app's "#/..." routes.
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

const APP_MAP: Record<string, string> = {
  '/app/dashboard': '/dashboard',
  '/app/organization': '/organization',
  '/app/organization/members': '/organization?tab=members',
  '/app/organization/invitations': '/organization?tab=invitations',
  '/app/activity': '/organization?tab=activity',
  '/app/accounting': '/accounts',
  '/app/maintenance': '/maintenance-requests',
};
export const hashFor = (to: string) => (APP_MAP[to] ?? (to.startsWith('/app/') ? to.slice(4) : to));

let navState: unknown;
const parse = () => { const raw = window.location.hash.replace(/^#/, '') || '/'; const [pathname, search = ''] = raw.split('?'); return { pathname, search: search ? `?${search}` : '', state: navState }; };

export function useLocation() {
  const [loc, setLoc] = useState(parse);
  useEffect(() => { const f = () => setLoc(parse()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return loc;
}

type NavOpts = { replace?: boolean; state?: unknown };
export function useNavigate() {
  return (to: string, opts: NavOpts = {}) => {
    navState = opts.state;
    const hash = `#${hashFor(to)}`;
    if (opts.replace) window.location.replace(hash); else window.location.hash = hash;
  };
}

export function Navigate({ to, replace, state }: { to: string } & NavOpts) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace, state }); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Link({ to, state, replace, children, onClick, ...rest }: { to: string; children?: ReactNode } & NavOpts & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return <a {...rest} href={`#${hashFor(to)}`} onClick={(event) => { navState = state; onClick?.(event); }}>{children}</a>;
}
