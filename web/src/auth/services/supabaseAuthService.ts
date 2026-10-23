import { supabase, toError } from "../../lib/supabase";
import type { SignUpInput, User } from "../lib/types";
import { isValidEmail, passwordIsStrong } from "../lib/format";
import { ConfirmationRequiredError } from "../lib/errors";
import { userFromProfile } from "./supabaseMappers";

async function loadUser(authUser: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}): Promise<User | null> {
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  if (error) throw toError(error);
  // The signup trigger creates the profile; if it is missing or deactivated the account is unusable.
  if (!profile || profile.status !== "active") return null;
  return userFromProfile(
    { ...profile, email: profile.email ?? authUser.email },
    { emailVerified: Boolean(authUser.email_confirmed_at) }
  );
}

/** `remember` is ignored: Supabase always persists the session in this browser's local storage. */
export async function login(email: string, password: string, _remember = true): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      throw new Error("Please verify your email address before signing in.");
    }
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error("Incorrect email or password. Try again or use Forgot password.");
    }
    throw toError(error);
  }
  const user = await loadUser(data.user);
  if (!user) {
    await supabase.auth.signOut();
    throw new Error("This account has been deactivated. Contact your workspace owner.");
  }
  return user;
}

export async function signUp(input: SignUpInput): Promise<User> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  if (fullName.length < 2) throw new Error("Enter your full name.");
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  if (!passwordIsStrong(input.password)) throw new Error("Your password does not meet the requirements.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    if (/already registered/i.test(error.message)) {
      throw new Error("An account with this email already exists. Try signing in instead.");
    }
    throw toError(error);
  }
  // With "Confirm email" enabled Supabase returns the user but no session until the link is clicked.
  if (!data.session || !data.user) {
    throw new ConfirmationRequiredError(email);
  }
  const user = await loadUser(data.user);
  if (!user) throw new Error("Your account was created but its profile is not available yet. Please sign in again.");
  return user;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  // getUser() validates the token with the server, unlike getSession() which only reads local storage.
  const { data: verified, error } = await supabase.auth.getUser();
  if (error || !verified.user) return null;
  const user = await loadUser(verified.user);
  if (!user) await supabase.auth.signOut();
  return user;
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toError(error);
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  // The response is neutral on purpose: never reveal whether an account exists for this address.
  await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/login`,
  });
}

/** Prototype helper: in Supabase mode this re-sends the confirmation email. */
export async function verifyEmail(_userId: string): Promise<void> {
  const { data } = await supabase.auth.getUser();
  if (data.user?.email) await supabase.auth.resend({ type: "signup", email: data.user.email });
}

/** Sends the sign-up confirmation email again (used by the "check your inbox" page). */
export async function resendSignupEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
  if (error) throw toError(error, "We couldn't resend the email just now. Please try again in a minute.");
}

/** Demo data exists only in the mock backend; here "reset" just signs out. */
export async function resetDemoData(): Promise<void> {
  await supabase.auth.signOut();
}
