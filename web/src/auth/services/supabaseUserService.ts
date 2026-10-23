import { supabase } from "../../lib/supabase";
import type { User } from "../lib/types";

/**
 * Used by the invite dialog to say "this person already has an account". Supabase never lets the browser enumerate
 * accounts (and shouldn't), so this only returns people the caller already shares an organization with.
 */
export async function getUserDirectory(): Promise<Pick<User, "id" | "fullName" | "email">[]> {
  const { data } = await supabase.from("profiles").select("id, full_name, email");
  return (data ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name || profile.email || "",
    email: profile.email ?? "",
  }));
}
