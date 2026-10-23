import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, CircleAlert, Info, Lock, RotateCcw, Save, Search, Undo2, X } from "lucide-react";
import { Button as TnButton } from "../tenants/components/ui";
import { useAuth } from "../auth/contexts/AuthContext";
import { useOrganization } from "../auth/contexts/OrganizationContext";
import { membershipService } from "../auth/services";
import { isSupabaseConfigured } from "../lib/supabase";
const listOrganizationMembers = (orgId: string) => membershipService.listOrganizationMembers(orgId);
import { initials } from "../auth/lib/format";
import { cn } from "../auth/utils/cn";
import { CATEGORY_MAP, DEFAULT_CATEGORY, GROUP_LABELS, GROUP_ORDER, SEARCH_INDEX, SETTINGS_CATEGORIES } from "./catalog";
import { Badge, Callout, Modal, Button, Toasts } from "./components/ui";
import GeneralPage from "./pages/GeneralPage";
import FinancialPage from "./pages/FinancialPage";
import PropertyPage from "./pages/PropertyPage";
import MaintenancePage from "./pages/MaintenancePage";
import ProjectsPage from "./pages/ProjectsPage";
import NotificationsPage from "./pages/NotificationsPage";
import TasksPage from "./pages/TasksPage";
import WorkflowPage from "./pages/WorkflowPage";
import DocumentsPage from "./pages/DocumentsPage";
import SecurityPage from "./pages/SecurityPage";
import DataPage from "./pages/DataPage";
import PersonalPage from "./pages/PersonalPage";
import { SettingsProvider, useSettings } from "./store";
import type { CategoryId, DirectoryTab, Member, Organization, PageProps } from "./types";
import { friendlyErrorList, validateCategory } from "./validation";
import { clone } from "./utils";
import "../auth/auth.css";
import "./settings.css";

const PAGE_COMPONENTS: Record<CategoryId, (props: PageProps) => React.ReactElement> = {
  general: GeneralPage,
  financial: FinancialPage,
  property: PropertyPage,
  maintenance: MaintenancePage,
  projects: ProjectsPage,
  notifications: NotificationsPage,
  tasks: TasksPage,
  workflow: WorkflowPage,
  documents: DocumentsPage,
  security: SecurityPage,
  data: DataPage,
  personal: PersonalPage,
};

const goto = (category: CategoryId) => { window.location.hash = `#/system-settings?cat=${category}`; };
const openDirectory = (tab: DirectoryTab) => { window.location.hash = `#/organization?tab=${tab === "members" ? "members" : tab === "invitations" ? "invitations" : "activity"}`; };

function SettingsBody({ category }: { category: CategoryId }) {
  const { orgSettings, prefs, prefsDefaults, savePreferences, resetPreferences, activeOrg, role, canEdit, saveCategory, resetCategory, notify, members, activity, defaults, revision, toasts, dismissToast } = useSettings();
  const readOnly = !canEdit(category);
  const isPersonal = category === "personal";
  const savedValue = useMemo(() => (isPersonal ? prefs : orgSettings[category] ?? defaults[category]), [isPersonal, prefs, orgSettings, defaults, category]);
  const [draft, setDraft] = useState<any>(() => clone(savedValue));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ category: CategoryId; anchor?: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const pendingAnchor = useRef<string | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formReadOnly = readOnly || saving;
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedValue);

  const clearTimer = () => { if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; } };

  useLayoutEffect(() => {
    setDraft(clone(savedValue)); setErrors({}); setSearch(""); setLastSavedAt(null);
    // reset when the organization, category or persisted values change through a save, reset or import
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg.id, category, revision]);

  const discardChanges = useCallback(() => { clearTimer(); setSaving(false); setDraft(clone(savedValue)); setErrors({}); }, [savedValue]);

  useEffect(() => { clearTimer(); setSaving(false); }, [activeOrg.id, category]);
  useEffect(() => clearTimer, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = undefined;
    const timer = setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    return () => clearTimeout(timer);
  }, [category]);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return { fields: [], categories: SETTINGS_CATEGORIES };
    const fields = SEARCH_INDEX.filter((entry) => `${entry.label} ${entry.keywords} ${CATEGORY_MAP[entry.category]?.label ?? ""}`.toLowerCase().includes(query)).slice(0, 9);
    const categories = SETTINGS_CATEGORIES.filter((entry) => `${entry.label} ${entry.description} ${entry.keywords.join(" ")}`.toLowerCase().includes(query));
    return { fields, categories };
  }, [search]);

  const scrollToAnchor = (anchor?: string) => { if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120); };
  const goCategory = (next: CategoryId, anchor?: string) => {
    setSearch(""); setErrors({});
    if (next === category) { scrollToAnchor(anchor); return; }
    pendingAnchor.current = anchor;
    goto(next);
  };
  const attemptCategory = (next: CategoryId, anchor?: string) => {
    if (next === category) { scrollToAnchor(anchor); setSearch(""); return; }
    if (dirty) { setPending({ category: next, anchor }); return; }
    goCategory(next, anchor);
  };

  const update = (key: string, value: unknown) => {
    setDraft((current: any) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleSave = () => {
    if (readOnly || saving) return;
    const validation = validateCategory(category, draft);
    const count = Object.keys(validation).length;
    if (count) {
      setErrors(validation);
      notify("Changes were not saved", "error", `${count} field${count === 1 ? "" : "s"} need attention. Review the highlighted fields.`);
      setTimeout(() => document.getElementById("settings-error-summary")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      return;
    }
    setErrors({}); setSaving(true);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      if (isPersonal) savePreferences(draft); else saveCategory(category, draft);
      setSaving(false); setLastSavedAt(new Date());
      notify(isPersonal ? "Personal preferences saved" : `${CATEGORY_MAP[category].shortLabel} settings saved`, "success", isPersonal ? "Your choices apply to your account only." : `Changes are scoped to ${activeOrg.name}.`);
    }, 700);
  };

  const handleDiscard = () => {
    if (!dirty) return;
    discardChanges();
    notify("Changes discarded", "info", "Restored the last saved configuration for this category.");
  };

  const confirmReset = () => {
    setResetOpen(false); clearTimer(); setSaving(false);
    if (isPersonal) { resetPreferences(); setDraft(clone({ ...prefsDefaults, theme: "dark" })); } else { resetCategory(category); setDraft(clone(defaults[category])); }
    setLastSavedAt(new Date()); setErrors({});
    notify(isPersonal ? "Personal preferences reset" : `${CATEGORY_MAP[category].shortLabel} settings reset`, "success", "Only this category was restored. Existing records are unchanged.");
  };

  const Page = PAGE_COMPONENTS[category];
  const meta = CATEGORY_MAP[category];
  const CategoryIcon = meta.icon;
  const validationErrors = Object.values(errors).filter(Boolean);

  return <div className="tn ss">
    <div className="app-shell"><div className="main-shell"><main className="main-content">
      <div className="page-heading">
        <div>
          <div className="page-title-line"><h1>System Settings</h1><span className="muted">{activeOrg.name}</span></div>
          <p>Configure how your organization operates: defaults, accounting rules, notifications, security and data.</p>
        </div>
        <div className="page-heading-actions">
          <TnButton type="button" onClick={handleDiscard} disabled={!dirty || saving || readOnly}><Undo2 size={15} />Discard</TnButton>
          <TnButton type="button" variant="primary" onClick={handleSave} disabled={!dirty || saving || readOnly}><Save size={15} />{saving ? "Saving…" : "Save changes"}</TnButton>
          <TnButton type="button" onClick={() => setResetOpen(true)} disabled={readOnly || saving}><RotateCcw size={15} />Reset</TnButton>
        </div>
      </div>

      <section className="directory-panel" aria-label="System settings">
        <div className="u-root au-root ss-body">
          <div className="grid items-start gap-5 p-4 lg:grid-cols-[252px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-4">
              <div className="ss-card">
                <div className="border-b border-u-line p-2.5">
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-u-muted" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search settings…" aria-label="Search settings" className="ss-search" />
                    {search ? <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-u-muted hover:text-u-ink"><X size={14} /></button> : null}
                  </div>
                </div>

                {search.trim() ? (
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">{matches.fields.length + matches.categories.length} matches</p>
                    {matches.fields.map((entry) => (
                      <button key={`${entry.category}-${entry.label}`} type="button" onClick={() => attemptCategory(entry.category, entry.anchor)} className="group flex w-full items-start justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-u-s2">
                        <span className="min-w-0"><span className="block text-[12px] font-medium text-u-ink2 group-hover:text-u-accent">{entry.label}</span><span className="mt-0.5 block text-[10.5px] text-u-muted">{CATEGORY_MAP[entry.category].shortLabel}</span></span>
                        <ChevronRight size={14} className="mt-0.5 shrink-0 text-u-s3" />
                      </button>
                    ))}
                    {matches.categories.length ? <>
                      <p className="mt-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-u-muted">Categories</p>
                      {matches.categories.map((entry) => (
                        <button key={entry.id} type="button" onClick={() => attemptCategory(entry.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-u-s2">
                          <entry.icon size={14} className="text-u-muted" /><span className="text-[12px] font-medium text-u-ink2">{entry.label}</span>
                        </button>
                      ))}
                    </> : null}
                    {!matches.fields.length && !matches.categories.length ? <div className="px-2 py-6 text-center"><Search size={20} className="mx-auto text-u-s3" /><p className="mt-2 text-[12px] font-medium text-u-ink2">No settings found</p><p className="mt-0.5 text-[11px] text-u-muted">Try “rent”, “email” or “invoice”.</p></div> : null}
                  </div>
                ) : (
                  <nav className="p-2" aria-label="Settings categories">
                    {GROUP_ORDER.map((group) => (
                      <div key={group}>
                        <p className="px-2 pb-1 pt-2 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-u-muted">{GROUP_LABELS[group]}</p>
                        <div className="space-y-0.5">
                          {SETTINGS_CATEGORIES.filter((entry) => entry.group === group).map((entry) => {
                            const active = entry.id === category;
                            return (
                              <button key={entry.id} type="button" onClick={() => attemptCategory(entry.id)} aria-current={active ? "page" : undefined}
                                className={cn("group flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition", active ? "bg-u-accent-soft text-u-accent ring-1 ring-inset ring-u-accent/20" : "text-u-ink2 hover:bg-u-s2 hover:text-u-ink")}>
                                <entry.icon size={16} className={cn("shrink-0", active ? "text-u-accent" : "text-u-muted")} />
                                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{entry.label}</span>
                                {!canEdit(entry.id) ? <Lock size={12} className="shrink-0 text-u-s3" /> : null}
                                {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-u-accent" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </nav>
                )}

                <div className="border-t border-u-line p-2.5">
                  <div className="flex items-start gap-2 rounded-lg bg-u-s2 px-2.5 py-2">
                    <Info size={14} className="mt-0.5 shrink-0 text-u-muted" />
                    <div><p className="text-[11px] font-medium text-u-ink2">{isSupabaseConfigured ? "Organization settings" : "Prototype settings"}</p><p className="mt-0.5 text-[10.5px] leading-relaxed text-u-muted">{isSupabaseConfigured ? "Saved for everyone in this organization; your personal preferences are saved to your account." : "Stored in your browser per organization. No production policies are enforced."}</p></div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="min-w-0" aria-live="polite">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-u-line bg-u-card text-u-ink2"><CategoryIcon size={18} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-[17px] font-semibold tracking-[-0.02em] text-u-ink">{meta.label}</h2><Badge tone={isPersonal ? "violet" : "blue"}>{isPersonal ? "Personal scope" : "Organization-wide"}</Badge></div>
                    <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-u-muted">{meta.description}</p>
                  </div>
                </div>
                <div className="pt-1 text-[11.5px]">
                  {saving ? <span className="text-u-muted">Saving…</span>
                    : dirty ? <span className="flex items-center gap-1.5 font-medium text-u-warn"><span className="h-1.5 w-1.5 rounded-full bg-u-warn" />Unsaved changes</span>
                    : <span className="flex items-center gap-1.5 text-u-muted"><CheckCircle2 size={14} className="text-u-ok" />{lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "All changes saved"}</span>}
                </div>
              </div>

              {readOnly ? <Callout tone="warning" icon={Lock} title="View-only access" className="mb-4">You are viewing these settings as <strong>{role}</strong>. Your role can review this category but cannot change it. Ask an Owner or Administrator if a change is needed.</Callout> : null}

              {validationErrors.length ? (
                <div id="settings-error-summary" className="mb-4">
                  <Callout tone="danger" icon={CircleAlert} title={`Your changes were not saved (${validationErrors.length} issue${validationErrors.length === 1 ? "" : "s"})`}>
                    <ul className="mt-1 space-y-1">{friendlyErrorList(errors).map((message, index) => <li key={`${message}-${index}`}>• {message}</li>)}</ul>
                  </Callout>
                </div>
              ) : null}

              <div key={`${activeOrg.id}:${category}`}>
                <Page value={draft} update={update} readOnly={formReadOnly} errors={errors} org={activeOrg} prefs={prefs}
                  navigate={(next, anchor) => attemptCategory(next, anchor)} openDirectory={openDirectory} notify={notify} activity={activity} members={members} />
              </div>

              {!readOnly ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-u-line bg-u-card px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11.5px] text-u-muted"><Info size={14} />Saving updates only this category and never changes existing rental records.</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={handleDiscard} disabled={!dirty || saving}>Discard</Button>
                    <Button type="button" variant="primary" size="sm" icon={Save} loading={saving} onClick={handleSave} disabled={!dirty || saving}>Save changes</Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <Modal open={pending !== null} onClose={() => setPending(null)} title="You have unsaved changes" description="Leaving this category will discard your edits since the last save." icon={CircleAlert} size="sm"
            footer={<>
              <Button type="button" variant="secondary" onClick={() => setPending(null)}>Keep editing</Button>
              <Button type="button" variant="danger" onClick={() => { const next = pending; setPending(null); if (!next) return; discardChanges(); goCategory(next.category, next.anchor); }}>Discard & continue</Button>
            </>}>
            <p className="text-[12.5px] leading-relaxed text-u-ink2">Your changes to <span className="font-medium">{meta.label}</span> have not been saved. You can continue editing, or discard them and move to another section.</p>
          </Modal>

          <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={`Reset ${meta.shortLabel.toLowerCase()} settings?`} description="Only this category will be restored. No other settings or records are affected." icon={RotateCcw} size="sm"
            footer={<>
              <Button type="button" variant="secondary" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button type="button" variant="danger" icon={RotateCcw} onClick={confirmReset}>Reset to defaults</Button>
            </>}>
            <div className="space-y-3">
              <p className="text-[12.5px] leading-relaxed text-u-ink2">This restores the default values for <span className="font-medium">{meta.label}</span> for {activeOrg.name}. This action does not delete records or reset the full application.</p>
              {dirty ? <Callout tone="warning" icon={CircleAlert}>Your current unsaved edits in this category will be lost.</Callout> : null}
            </div>
          </Modal>
          <Toasts toasts={toasts} onDismiss={dismissToast} />
        </div>
      </section>
    </main></div></div>
  </div>;
}

export default function SystemSettings({ params }: { params?: Record<string, string> }) {
  const { activeOrganization, activeRole } = useOrganization();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const orgId = activeOrganization?.id;

  useEffect(() => {
    if (!orgId) return;
    let live = true;
    listOrganizationMembers(orgId).then((rows) => {
      if (!live) return;
      setMembers(rows.map(({ membership, user: u }) => ({
        id: membership.id, name: u.fullName, email: u.email, role: membership.role, status: membership.status === "active" ? "Active" : "Suspended",
        initials: initials(u.fullName), avatarTone: "", lastActive: "",
      })));
    });
    return () => { live = false; };
  }, [orgId]);

  const org = useMemo<Organization | null>(() => (activeOrganization && activeRole ? { id: activeOrganization.id, name: activeOrganization.name, shortName: activeOrganization.name.split(" ")[0], role: activeRole } : null), [activeOrganization, activeRole]);
  const actor = useMemo(() => ({ id: user?.id ?? "anonymous", name: user?.fullName ?? "Unknown user", initials: initials(user?.fullName ?? "?") }), [user]);
  if (!org) return null;

  const wanted = (params?.cat ?? DEFAULT_CATEGORY) as CategoryId;
  const category = CATEGORY_MAP[wanted] ? wanted : DEFAULT_CATEGORY;
  return <SettingsProvider org={org} members={members} actor={actor}><SettingsBody key={`${org.id}:${category}`} category={category} /></SettingsProvider>;
}
