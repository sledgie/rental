import { db } from "../db";
import * as schema from "../db/schema";
import { eq } from "../db/ops";
import type { Permission, Role } from "./deposits/domain";
import { can } from "./deposits/domain";

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  title: string;
  initials: string;
  email: string;
};

// The original kept the signed-in staff member in a cookie; here it is just a module variable (resets on reload).
let currentStaffId = "";
export const setCurrentStaffId = (id: string) => {
  currentStaffId = id;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const rows = await db.select().from(schema.staff);
  const found = rows.find((r) => r.id === currentStaffId) ?? rows.find((r) => r.role === "admin") ?? rows[0];
  if (!found) {
    return { id: "staff-admin", name: "Alex Morgan", role: "admin", title: "System Administrator", initials: "AM", email: "alex.morgan@meridianpm.ca" };
  }
  return { id: found.id, name: found.name, role: (found.role as Role) ?? "admin", title: found.title, initials: found.initials, email: found.email };
}

export async function canCurrent(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return can(user.role, permission);
}

export async function getStaffList() {
  return db.select().from(schema.staff);
}

export async function getStaffById(id: string) {
  const rows = await db.select().from(schema.staff).where(eq(schema.staff.id, id));
  return rows[0] ?? null;
}
