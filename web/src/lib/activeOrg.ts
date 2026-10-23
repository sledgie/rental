/**
 * The organization the signed-in user is currently working in. OrganizationProvider keeps it up to date; data modules
 * that live outside React (the property store, ...) subscribe to reload when it changes.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export const getActiveOrgId = () => current;

export function setActiveOrgId(id: string | null) {
  if (id === current) return;
  current = id;
  listeners.forEach((listener) => listener());
}

export function subscribeActiveOrg(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
