import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock3, Hash, Info, Landmark, Mail, MapPin, LockKeyhole, RotateCcw, Save, ShieldAlert, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { BUSINESS_TYPES, COUNTRIES, CURRENCIES, TIMEZONES } from '../auth/lib/constants';
import { orgMonogram } from '../auth/lib/format';
import type { OrganizationInput } from '../auth/lib/types';
import { useOrganization } from '../auth/contexts/OrganizationContext';
import { useToast } from '../auth/contexts/ToastContext';
import MembersPage from '../auth/pages/organization/MembersPage';
import OrganizationInvitationsPage from '../auth/pages/organization/OrganizationInvitationsPage';
import ActivityLogsPage from '../auth/pages/organization/ActivityLogsPage';
import { EMPTY_EXTRAS, loadExtras, saveExtras, validateExtras, type ProfileExtras } from './profileExtras';
import '../auth/auth.css';
import './organization.css';

const REGION_PRESETS: Record<string, { currency: string; timezone: string }> = {
  Canada: { currency: 'CAD', timezone: 'America/Toronto' }, 'United States': { currency: 'USD', timezone: 'America/New_York' },
  'United Kingdom': { currency: 'GBP', timezone: 'Europe/London' }, Australia: { currency: 'AUD', timezone: 'Australia/Sydney' },
  'New Zealand': { currency: 'NZD', timezone: 'Pacific/Auckland' }, Ireland: { currency: 'EUR', timezone: 'Europe/Dublin' },
  Germany: { currency: 'EUR', timezone: 'Europe/Paris' }, France: { currency: 'EUR', timezone: 'Europe/Paris' }, Spain: { currency: 'EUR', timezone: 'Europe/Paris' },
  Netherlands: { currency: 'EUR', timezone: 'Europe/Paris' }, 'United Arab Emirates': { currency: 'AED', timezone: 'Asia/Dubai' }, Singapore: { currency: 'SGD', timezone: 'Asia/Singapore' },
};
const TABS = [['profile', 'Profile'], ['members', 'Members'], ['invitations', 'Invitations'], ['activity', 'Activity log']] as const;
type Tab = (typeof TABS)[number][0];

const fmt = (iso: string, time = false) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(iso));

function Field({ label, error, hint, counter, optional, className = '', children }: { label: string; optional?: boolean; error?: string; hint?: string; counter?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}>
    <span className="flex items-center justify-between"><span className="org-label">{label}{!optional && <span className="text-u-danger"> *</span>}</span>{counter}</span>
    {children}
    {error ? <span className="mt-1 block text-[11px] text-u-danger" role="alert">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-u-muted">{hint}</span> : null}
  </label>;
}

function Profile() {
  const { activeOrganization: org, activeRole, updateOrganization } = useOrganization();
  const { toast } = useToast();
  const initial = useMemo<OrganizationInput>(() => ({ name: org?.name ?? '', businessType: org?.businessType ?? 'Individual Landlord', country: org?.country ?? 'United States', currency: org?.currency ?? 'USD', timezone: org?.timezone ?? 'America/New_York' }), [org]);
  const [form, setForm] = useState<OrganizationInput>(initial);
  const initialExtras = useMemo<ProfileExtras>(() => (org ? loadExtras(org.id) : EMPTY_EXTRAS), [org?.id]);
  const [extras, setExtras] = useState<ProfileExtras>(initialExtras);
  const [savedExtras, setSavedExtras] = useState<ProfileExtras>(initialExtras);
  const [extraErrors, setExtraErrors] = useState<Partial<Record<keyof ProfileExtras, string>>>({});
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(initial); setErrors({}); }, [initial]);
  useEffect(() => { setExtras(initialExtras); setSavedExtras(initialExtras); setExtraErrors({}); }, [initialExtras]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || JSON.stringify(extras) !== JSON.stringify(savedExtras);
  const setExtra = (key: keyof ProfileExtras, value: string) => { setExtras((c) => ({ ...c, [key]: value })); setExtraErrors((c) => ({ ...c, [key]: undefined })); };
  const set = <K extends keyof OrganizationInput>(key: K, value: OrganizationInput[K]) => { setForm((c) => ({ ...c, [key]: value })); if (key === 'name') setErrors({}); };
  const setCountry = (country: string) => { const p = REGION_PRESETS[country]; setForm((c) => ({ ...c, country, currency: p?.currency ?? c.currency, timezone: p?.timezone ?? c.timezone })); };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const error = !name ? 'Organization name is required.' : name.length < 2 ? 'Use at least 2 characters.' : name.length > 60 ? 'Keep the name under 60 characters.' : '';
    const extraProblems = validateExtras(extras);
    if (error || Object.keys(extraProblems).length) { setErrors(error ? { name: error } : {}); setExtraErrors(extraProblems); return; }
    setSaving(true);
    try {
      await updateOrganization({ ...form, name });
      if (org) saveExtras(org.id, extras);
      setSavedExtras(extras);
      setSavedAt(new Date().toISOString());
      toast({ title: 'Organization updated', description: 'Changes are saved in this browser.', variant: 'success' });
    } catch (caught) {
      toast({ title: 'Unable to save changes', description: caught instanceof Error ? caught.message : 'Try again.', variant: 'error' });
    } finally { setSaving(false); }
  }

  const record = [
    { icon: Hash, label: 'Organization ID', value: org?.id ?? '—' },
    { icon: Building2, label: 'Business type', value: org?.businessType ?? '—' },
    { icon: Landmark, label: 'Country', value: org?.country ?? '—' },
    { icon: Wallet, label: 'Currency', value: org?.currency ?? '—' },
    { icon: Clock3, label: 'Time zone', value: org?.timezone ?? '—' },
    { icon: Sparkles, label: 'Workspace created', value: org ? fmt(org.createdAt) : '—' },
  ];

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_312px]">
    <form id="org-form" onSubmit={submit} className="space-y-4">
      <div className="org-card">
        <div className="border-b border-u-line px-4 py-3.5"><h2 className="text-[13px] font-semibold text-u-ink">Workspace identity</h2><p className="mt-0.5 text-[11px] text-u-muted">Shown in the organization switcher, invitations, and reports.</p></div>
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-u-line bg-u-s2/60 p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-u-accent text-[13px] font-semibold text-u-onaccent">{orgMonogram(form.name || 'Organization')}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-u-ink">{form.name || 'Untitled organization'}</p><p className="text-[11px] text-u-muted">{form.businessType} · {form.country} · {form.currency}</p></div>
            <span className="rounded-full bg-u-s2 px-2 py-0.5 text-[10px] font-medium text-u-muted">Preview</span>
          </div>
          <Field label="Organization name" error={errors.name} hint="Visible to every active member of this organization." counter={<span className="text-[10px] text-u-muted">{form.name.length}/60</span>}>
            <input className="org-input" value={form.name} maxLength={60} disabled={saving} aria-invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Business type"><select className="org-input" value={form.businessType} disabled={saving} onChange={(e) => set('businessType', e.target.value as OrganizationInput['businessType'])}>{BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        </div>
      </div>

      <div className="org-card">
        <div className="border-b border-u-line px-4 py-3.5"><h2 className="flex items-center gap-2 text-[13px] font-semibold text-u-ink"><Mail size={14} className="text-u-muted" />Contact details</h2><p className="mt-0.5 text-[11px] text-u-muted">Where tenants and vendors can reach the organization.</p></div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Business email" optional error={extraErrors.email}><input type="email" className="org-input" value={extras.email} disabled={saving} aria-invalid={!!extraErrors.email} placeholder="hello@example.com" onChange={(e) => setExtra('email', e.target.value)} /></Field>
          <Field label="Business phone" optional hint="Include the area code."><input className="org-input" value={extras.phone} disabled={saving} placeholder="(503) 555-0184" onChange={(e) => setExtra('phone', e.target.value)} /></Field>
          <Field label="Website" optional error={extraErrors.website} className="sm:col-span-2"><input className="org-input" value={extras.website} disabled={saving} aria-invalid={!!extraErrors.website} placeholder="https://www.example.com" onChange={(e) => setExtra('website', e.target.value)} /></Field>
        </div>
      </div>

      <div className="org-card">
        <div className="border-b border-u-line px-4 py-3.5"><h2 className="flex items-center gap-2 text-[13px] font-semibold text-u-ink"><MapPin size={14} className="text-u-muted" />Business address</h2><p className="mt-0.5 text-[11px] text-u-muted">The legal mailing address for the organization. The country is set under Regional defaults.</p></div>
        <div className="grid gap-4 p-4 sm:grid-cols-6">
          <Field label="Street address" optional className="sm:col-span-6"><input className="org-input" value={extras.addressLine1} disabled={saving} onChange={(e) => setExtra('addressLine1', e.target.value)} /></Field>
          <Field label="Address line 2" optional className="sm:col-span-6"><input className="org-input" value={extras.addressLine2} disabled={saving} placeholder="Suite, unit or floor" onChange={(e) => setExtra('addressLine2', e.target.value)} /></Field>
          <Field label="City" optional className="sm:col-span-2"><input className="org-input" value={extras.city} disabled={saving} onChange={(e) => setExtra('city', e.target.value)} /></Field>
          <Field label="State / province" optional className="sm:col-span-2"><input className="org-input" value={extras.state} disabled={saving} onChange={(e) => setExtra('state', e.target.value)} /></Field>
          <Field label="Postal / ZIP" optional className="sm:col-span-2"><input className="org-input" value={extras.postalCode} disabled={saving} onChange={(e) => setExtra('postalCode', e.target.value)} /></Field>
        </div>
      </div>

      <div className="org-card">
        <div className="border-b border-u-line px-4 py-3.5"><h2 className="text-[13px] font-semibold text-u-ink">Regional defaults</h2><p className="mt-0.5 text-[11px] text-u-muted">Used for rent amounts, financial reports, and scheduled activity.</p></div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Country"><select className="org-input" value={form.country} disabled={saving} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Default currency"><select className="org-input" value={form.currency} disabled={saving} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
          <Field label="Time zone" className="sm:col-span-2"><select className="org-input" value={form.timezone} disabled={saving} onChange={(e) => set('timezone', e.target.value)}>{TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-u-line bg-u-s2/40 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-u-muted"><Info size={14} />Changing region does not convert existing stored amounts.</p>
          <div className="flex gap-2">
            <button type="button" className="org-btn" disabled={!dirty || saving} onClick={() => { setForm(initial); setErrors({}); setExtras(savedExtras); setExtraErrors({}); }}><RotateCcw size={14} />Discard</button>
            <button type="submit" className="org-btn org-btn-primary" disabled={!dirty || saving}><Save size={14} />{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>

      {savedAt && <div className="flex items-center gap-2 rounded-lg border border-u-ok/30 bg-u-ok/10 px-3 py-2.5 text-[12px] text-u-ok" role="status"><CheckCircle2 size={14} />Organization profile updated {fmt(savedAt, true)}. An activity log entry was created.</div>}
    </form>

    <div className="space-y-3">
      <div className="org-card">
        <div className="border-b border-u-line px-4 py-3"><p className="text-[12px] font-semibold text-u-ink">Workspace record</p></div>
        <dl className="divide-y divide-u-line text-[11.5px]">{record.map((row) => <div key={row.label} className="flex items-start gap-2 px-4 py-2.5"><row.icon size={14} className="mt-0.5 shrink-0 text-u-muted" /><dt className="text-u-muted">{row.label}</dt><dd className="ml-auto max-w-[150px] truncate text-right font-medium text-u-ink2" title={row.value}>{row.value}</dd></div>)}</dl>
        <div className="flex items-center justify-between border-t border-u-line bg-u-s2/40 px-4 py-2.5"><span className="text-[10.5px] text-u-muted">Your role</span><span className="rounded-full bg-u-accent-soft px-2 py-0.5 text-[10.5px] font-medium text-u-accent">{activeRole}</span></div>
      </div>
      <div className="org-card p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-u-ink"><ShieldCheck size={14} className="text-u-accent" />Permission boundary</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-u-muted">Owner and Administrator roles can edit this profile. Property Managers, Accountants, Maintenance Staff, and Auditors cannot access organization settings.</p>
        <div className="mt-3 flex items-center gap-1.5 rounded-md border border-u-line bg-u-s2 px-2 py-1.5 text-[10px] text-u-muted"><LockKeyhole size={12} />Authorization is re-checked by the mock service.</div>
      </div>
    </div>
  </div>;
}

export default function OrganizationProfile({ params }: { params?: Record<string, string> }) {
  const { activeOrganization: org, activeRole } = useOrganization();
  const wanted = (params?.tab ?? 'profile') as Tab;
  const tab: Tab = TABS.some(([id]) => id === wanted) ? wanted : 'profile';
  const allowed = activeRole === 'Owner' || activeRole === 'Administrator';
  const go = (id: Tab) => { window.location.hash = id === 'profile' ? '#/organization' : `#/organization?tab=${id}`; };

  return <div className="tn org">
    <div className="app-shell"><div className="main-shell"><main className="main-content">
      <div className="page-heading">
        <div>
          <div className="page-title-line"><h1>Organization</h1><span className="muted">{org?.name}</span></div>
          <p>The business identity, people and activity for this workspace. Changes apply everywhere this organization operates.</p>
        </div>
      </div>

      <section className="directory-panel" aria-label="Organization settings">
        <div className="directory-tabs" role="tablist">
          {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`directory-tab${tab === id ? ' selected' : ''}`} onClick={() => go(id)}>{label}</button>)}
        </div>
        <div className="u-root au-root org-body">
          <div className="p-4">
            {!allowed ? <div className="mx-auto max-w-xl py-10 text-center">
              <ShieldAlert size={30} className="mx-auto text-u-muted" />
              <h2 className="mt-3 text-sm font-semibold text-u-ink">You don't have access to organization settings</h2>
              <p className="mt-1.5 text-xs leading-5 text-u-muted">Your role in {org?.name ?? 'this organization'} is {activeRole ?? 'unavailable'}. Only Owners and Administrators can view or change organization settings, members and invitations.</p>
              <div className="mt-4 flex justify-center gap-2"><a className="org-btn org-btn-primary" href="#/dashboard">Return to dashboard</a><a className="org-btn" href="#/organizations/select">Choose another organization</a></div>
            </div> : tab === 'profile' ? <Profile /> : tab === 'members' ? <MembersPage /> : tab === 'invitations' ? <OrganizationInvitationsPage /> : <ActivityLogsPage />}
          </div>
        </div>
      </section>
    </main></div></div>
  </div>;
}
