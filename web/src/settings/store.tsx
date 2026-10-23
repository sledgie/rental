import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATEGORY_MAP } from "./catalog";
import { defaultOrganizationSettings, defaultUserPreferences } from "./mockSettings";
import {
  appendActivityLog,
  exportMockSettings,
  getActivityLog,
  getOrganizationSettings,
  getUserPreferences,
  resetUserPreferences,
  updateUserPreferences,
  importOrganizationSettings,
  resetOrganizationCategory,
  updateOrganizationSettings,
} from "./mockSettingsService";
import type { ActivityEvent, CategoryId, Member, Organization, OrgSettings, Role, ToastMessage, ToastTone, UserPreferences } from "./types";
import { uid } from "./utils";
import { applyTheme, currentTheme } from "../shell/theme";

interface SettingsContextValue {
  activeOrg: Organization;
  role: Role;
  members: Member[];
  activity: ActivityEvent[];
  orgSettings: OrgSettings;
  prefs: UserPreferences;
  prefsDefaults: UserPreferences;
  savePreferences: (value: UserPreferences) => void;
  resetPreferences: () => void;
  toasts: ToastMessage[];
  saveCategory: (category: CategoryId, value: unknown) => void;
  resetCategory: (category: CategoryId) => void;
  importSettings: (categories: CategoryId[], data: Partial<OrgSettings>) => void;
  addActivity: (action: string, detail?: string, category?: CategoryId) => void;
  notify: (message: string, tone?: ToastTone, description?: string) => void;
  dismissToast: (id: number) => void;
  canEdit: (category: CategoryId) => boolean;
  defaults: OrgSettings;
  revision: number;
  exportSettings: () => Record<string, unknown>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Categories each role may edit; Owners can edit everything. */
const ROLE_ACCESS: Record<Role, CategoryId[] | "all"> = {
  Owner: "all",
  Administrator: ["general", "financial", "property", "maintenance", "projects", "notifications", "tasks", "workflow", "documents", "security", "data"],
  "Property Manager": ["property", "maintenance", "projects", "notifications"],
  Accountant: ["financial", "documents", "data"],
  "Maintenance Staff": ["maintenance"],
  "Read-Only / Auditor": [],
};

interface ProviderProps {
  org: Organization;
  members: Member[];
  actor: { id: string; name: string; initials: string };
  children: ReactNode;
}

export function SettingsProvider({ org, members, actor, children }: ProviderProps) {
  const defaults = useMemo(() => defaultOrganizationSettings(org), [org]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>(() => getOrganizationSettings(org.id, defaults));
  const prefsDefaults = useMemo(() => defaultUserPreferences(currentTheme()), []);
  const [prefs, setPrefs] = useState<UserPreferences>(() => getUserPreferences(actor.id, prefsDefaults));
  const [activity, setActivity] = useState<ActivityEvent[]>(() => getActivityLog(org.id, []));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [revision, setRevision] = useState(0);
  const bumpRevision = useCallback(() => setRevision((current) => current + 1), []);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = "success", description?: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-2), { id, message, tone, description }]);
    timers.current[id] = setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      delete timers.current[id];
    }, 4800);
  }, []);

  const addActivity = useCallback((action: string, detail?: string, category?: CategoryId) => {
    const event: ActivityEvent = { id: uid("act"), actor: actor.name, actorInitials: actor.initials, action, detail, at: new Date().toISOString(), category };
    setActivity((current) => [event, ...current].slice(0, 250));
    appendActivityLog(org.id, event, []);
  }, [org.id, actor.name, actor.initials]);

  const saveCategory = useCallback((category: CategoryId, value: unknown) => {
    setOrgSettings(updateOrganizationSettings(org.id, { [category]: value } as Partial<OrgSettings>, defaults));
    bumpRevision();
    addActivity(`Updated ${CATEGORY_MAP[category]?.shortLabel.toLowerCase() ?? category} settings`, `${CATEGORY_MAP[category]?.label ?? category} · saved configuration`, category);
  }, [org.id, defaults, addActivity, bumpRevision]);

  const resetCategory = useCallback((category: CategoryId) => {
    setOrgSettings(resetOrganizationCategory(org.id, category, defaults));
    bumpRevision();
    addActivity(`Reset ${CATEGORY_MAP[category]?.shortLabel.toLowerCase() ?? category} settings`, "Restored prototype defaults for this category", category);
  }, [org.id, defaults, addActivity, bumpRevision]);

  const importSettings = useCallback((categories: CategoryId[], data: Partial<OrgSettings>) => {
    const imported: Partial<OrgSettings> = {};
    categories.forEach((category) => { if (data[category] !== undefined) imported[category] = data[category]; });
    setOrgSettings(importOrganizationSettings(org.id, imported, defaults));
    bumpRevision();
    addActivity("Imported organization configuration", `${categories.length} categor${categories.length === 1 ? "y" : "ies"} updated · simulated import`, "data");
  }, [org.id, defaults, addActivity, bumpRevision]);

  const savePreferences = useCallback((value: UserPreferences) => {
    applyTheme(value.theme);
    setPrefs(updateUserPreferences(actor.id, value, { ...prefsDefaults, theme: value.theme }));
    bumpRevision();
    addActivity("Updated personal preferences", "Personal settings are scoped to the signed-in user");
  }, [actor.id, prefsDefaults, addActivity, bumpRevision]);

  const resetPreferences = useCallback(() => {
    const fresh = defaultUserPreferences("dark");
    applyTheme(fresh.theme);
    setPrefs(resetUserPreferences(actor.id, fresh));
    bumpRevision();
    addActivity("Reset personal preferences", "Restored personal defaults");
  }, [actor.id, addActivity, bumpRevision]);

  const canEdit = useCallback((category: CategoryId) => {
    if (category === "personal") return true;
    const allowed = ROLE_ACCESS[org.role];
    return allowed === "all" || allowed.includes(category);
  }, [org.role]);

  const exportSettings = useCallback(() => exportMockSettings(org.id, org.name, defaults), [org.id, org.name, defaults]);

  const value: SettingsContextValue = {
    activeOrg: org, role: org.role, members, activity, orgSettings, prefs, prefsDefaults, savePreferences, resetPreferences, toasts,
    saveCategory, resetCategory, importSettings, addActivity, notify, dismissToast, canEdit, defaults, revision, exportSettings,
  };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}
