import { getDatabase } from "../mock/store";
import type { User } from "../lib/types";
import { simulate } from "./mockApi";

export async function getUserDirectory(): Promise<Pick<User, "id" | "fullName" | "email">[]> {
  return simulate(() =>
    getDatabase().users.map(({ id, fullName, email }) => ({ id, fullName, email }))
  );
}
