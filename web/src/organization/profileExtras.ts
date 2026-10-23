// Contact details and business address for an organization, kept per organization in this browser (no backend yet).
export interface ProfileExtras {
  email: string; phone: string; website: string;
  addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string;
}
export const EMPTY_EXTRAS: ProfileExtras = { email: '', phone: '', website: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '' };

const key = (orgId: string) => `keystone.org-profile.${orgId}`;

export function loadExtras(orgId: string): ProfileExtras {
  try { const raw = localStorage.getItem(key(orgId)); if (raw) return { ...EMPTY_EXTRAS, ...JSON.parse(raw) }; } catch { /* storage unavailable */ }
  return EMPTY_EXTRAS;
}
export function saveExtras(orgId: string, extras: ProfileExtras): void {
  try { localStorage.setItem(key(orgId), JSON.stringify(extras)); } catch { /* storage unavailable */ }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateExtras(extras: ProfileExtras): Partial<Record<keyof ProfileExtras, string>> {
  const errors: Partial<Record<keyof ProfileExtras, string>> = {};
  if (extras.email && !EMAIL.test(extras.email)) errors.email = 'Enter a valid email address.';
  if (extras.website && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/.test(extras.website)) errors.website = 'Use a full URL starting with http:// or https://.';
  return errors;
}
