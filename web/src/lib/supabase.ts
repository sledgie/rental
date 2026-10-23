import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** When either variable is missing the app keeps running on its in-browser mock data. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** The browser only ever gets the anon (publishable) key; Row-Level Security does the authorization. */
export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  anonKey ?? "anon-key-not-configured",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

/** Postgres/PostgREST errors are plain objects; the UI expects Error instances with a readable message. */
export function toError(error: { message?: string } | null | undefined, fallback = "Something went wrong. Please try again."): Error {
  return new Error(error?.message?.trim() || fallback);
}
