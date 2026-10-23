import type { MockDatabase } from "../lib/types";
import { mockActivityLogs } from "./activity";
import { mockInvitations } from "./invitations";
import { mockMemberships } from "./memberships";
import { mockOrganizations } from "./organizations";
import { mockUsers } from "./users";

/**
 * DEVELOPMENT-ONLY persistence.
 *
 * This module is the single storage adapter for the prototype. UI components and
 * React contexts never read localStorage directly — they call the mock services,
 * which can later be swapped for real HTTP services. The stored passwords are
 * mock credentials and must never be used in a production product.
 */
const DB_KEY = "rentflow.mock.db.v1";
const SESSION_KEY = "rentflow.mock.session.v1";
const SESSION_TAB_KEY = "rentflow.mock.session.tab.v1";
const SEED_VERSION = 3;

interface StoredEnvelope {
  version: number;
  data: MockDatabase;
}

let memoryCache: MockDatabase | null = null;

const clone = <T,>(value: T): T =>
  typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));

const isBrowser = typeof window !== "undefined";

export function createSeedDatabase(): MockDatabase {
  const activeOrganizationByUser: Record<string, string | null> = {};
  for (const user of mockUsers) {
    const memberships = mockMemberships.filter(
      (membership) => membership.userId === user.id && membership.status === "active"
    );
    if (memberships.length === 1) activeOrganizationByUser[user.id] = memberships[0].organizationId;
  }
  // Alex and Jordan retain their chosen workspaces; Maya has multiple workspaces
  // with no selection so the organization picker can be demonstrated.
  activeOrganizationByUser["user-001"] = "org-001";
  activeOrganizationByUser["user-002"] = null;
  activeOrganizationByUser["user-004"] = "org-003";
  activeOrganizationByUser["user-007"] = "org-003";

  return {
    users: clone(mockUsers),
    organizations: clone(mockOrganizations),
    memberships: clone(mockMemberships),
    invitations: clone(mockInvitations),
    activityLogs: clone(mockActivityLogs),
    activeOrganizationByUser,
  };
}

function normalizeExpiredInvitations(db: MockDatabase): MockDatabase {
  const now = Date.now();
  db.invitations = db.invitations.map((invitation) =>
    invitation.status === "pending" && new Date(invitation.expiresAt).getTime() < now
      ? { ...invitation, status: "expired" }
      : invitation
  );
  return db;
}

function readEnvelope(): MockDatabase | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEnvelope;
    if (
      !parsed?.data ||
      !Array.isArray(parsed.data.users) ||
      !Array.isArray(parsed.data.organizations) ||
      !Array.isArray(parsed.data.memberships) ||
      !Array.isArray(parsed.data.invitations)
    ) {
      return null;
    }
    if (parsed.version !== SEED_VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function getDatabase(): MockDatabase {
  if (memoryCache) return normalizeExpiredInvitations(clone(memoryCache));
  const stored = readEnvelope();
  if (stored) {
    memoryCache = stored;
    return normalizeExpiredInvitations(clone(stored));
  }
  const seed = createSeedDatabase();
  memoryCache = seed;
  persist(seed);
  return normalizeExpiredInvitations(clone(seed));
}

function persist(db: MockDatabase): void {
  memoryCache = db;
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify({ version: SEED_VERSION, data: db }));
  } catch {
    // Storage can be unavailable (private mode / sandboxed iframe). The in-memory
    // cache keeps the prototype functional for the current session.
  }
}

/**
 * Apply a mutation to a cloned draft and persist only when the whole operation
 * succeeds. Throwing inside the mutator leaves the previous state untouched.
 */
export function mutateDatabase<T>(mutator: (draft: MockDatabase) => T): T {
  const draft = getDatabase();
  const result = mutator(draft);
  persist(draft);
  return result;
}

export interface StoredSession {
  userId: string;
  remember: boolean;
}

export function readStoredSession(): StoredSession | null {
  if (!isBrowser) return null;
  try {
    const remembered = window.localStorage.getItem(SESSION_KEY);
    if (remembered) {
      const parsed = JSON.parse(remembered) as { userId?: string };
      if (parsed?.userId) return { userId: parsed.userId, remember: true };
    }
    const tab = window.sessionStorage.getItem(SESSION_TAB_KEY);
    if (tab) {
      const parsed = JSON.parse(tab) as { userId?: string };
      if (parsed?.userId) return { userId: parsed.userId, remember: false };
    }
  } catch {
    return null;
  }
  return null;
}

export function writeStoredSession(userId: string, remember: boolean): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_TAB_KEY);
    const payload = JSON.stringify({ userId, createdAt: new Date().toISOString() });
    if (remember) window.localStorage.setItem(SESSION_KEY, payload);
    else window.sessionStorage.setItem(SESSION_TAB_KEY, payload);
  } catch {
    // Non-fatal for the prototype.
  }
}

export function clearStoredSession(): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_TAB_KEY);
  } catch {
    // Non-fatal.
  }
}

export function resetDemoDatabase(): void {
  memoryCache = null;
  clearStoredSession();
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(DB_KEY);
  } catch {
    // Non-fatal.
  }
}


