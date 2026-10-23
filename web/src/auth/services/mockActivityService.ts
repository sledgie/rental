import { makeId, simulate } from "./mockApi";
import type { ActivityLog, ActivityType, MockDatabase } from "../lib/types";
import { getDatabase } from "../mock/store";
import { mockUsers } from "../mock/users";

export function appendActivity(
  db: MockDatabase,
  input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    detail: string;
    type: ActivityType;
  }
): ActivityLog {
  const entry: ActivityLog = {
    id: makeId("activity"),
    createdAt: new Date().toISOString(),
    ...input,
  };
  db.activityLogs.unshift(entry);
  return entry;
}

export interface ActivityRow extends ActivityLog {
  actorName: string;
}

export async function listOrganizationActivity(organizationId: string): Promise<ActivityRow[]> {
  return simulate(() => {
    const db = getDatabase();
    return db.activityLogs
      .filter((entry) => entry.organizationId === organizationId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((entry) => ({
        ...entry,
        actorName:
          db.users.find((user) => user.id === entry.actorUserId)?.fullName ??
          mockUsers.find((user) => user.id === entry.actorUserId)?.fullName ??
          "System",
      }));
  });
}
