import {
  clearStoredSession,
  getDatabase,
  mutateDatabase,
  readStoredSession,
  resetDemoDatabase,
  writeStoredSession,
} from "../mock/store";
import type { ProfileInput, SignUpInput, User } from "../lib/types";
import { passwordIsStrong, isValidEmail } from "../lib/format";
import { assert, delay, makeId, normalizeEmail, simulate } from "./mockApi";

/**
 * Mock authentication service. Credentials are checked against the local mock
 * dataset and a lightweight session id is persisted. This is NOT security.
 */
export async function login(
  email: string,
  password: string,
  remember = true
): Promise<User> {
  const user = await simulate(() => {
    const db = getDatabase();
    const normalized = normalizeEmail(email);
    const found = db.users.find((candidate) => candidate.email.toLowerCase() === normalized);
    assert(found, "We couldn't find an account with that email address.");
    assert(
      found.status === "active",
      "This account has been deactivated. Contact your workspace owner."
    );
    assert(found.password === password, "Incorrect password. Try again or use Forgot password.");
    assert(found.emailVerified, "Please verify your email address before signing in.");
    return found;
  }, 720);

  writeStoredSession(user.id, remember);
  return user;
}

export async function signUp(input: SignUpInput): Promise<User> {
  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);
  assert(fullName.length >= 2, "Enter your full name.");
  assert(isValidEmail(email), "Enter a valid email address.");
  assert(passwordIsStrong(input.password), "Your password does not meet the requirements.");

  const user = await simulate(
    () =>
      mutateDatabase((draft) => {
        assert(
          !draft.users.some((candidate) => candidate.email.toLowerCase() === email),
          "An account with this email already exists. Try signing in instead."
        );
        const created: User = {
          id: makeId("user"),
          fullName,
          email,
          password: input.password,
          status: "active",
          // Simulated email verification for the prototype. No email is sent.
          emailVerified: true,
          createdAt: new Date().toISOString(),
        };
        draft.users.push(created);
        // Signing up never creates an organization or Owner membership.
        draft.activeOrganizationByUser[created.id] = null;
        return created;
      }),
    820
  );

  writeStoredSession(user.id, true);
  return user;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = readStoredSession();
  if (!session) return null;
  await delay(160);
  const db = getDatabase();
  const user = db.users.find((candidate) => candidate.id === session.userId);
  if (!user || user.status !== "active") {
    clearStoredSession();
    return null;
  }
  return user;
}

export async function logout(): Promise<void> {
  await delay(220);
  clearStoredSession();
}

export async function requestPasswordReset(email: string): Promise<void> {
  assert(isValidEmail(email), "Enter a valid email address.");
  // Neutral response on purpose — never reveal whether an account exists.
  await delay(880);
}

/** Development shortcut for the simulated verification state. */
export async function verifyEmail(userId: string): Promise<void> {
  await delay(300);
  mutateDatabase((draft) => {
    const user = draft.users.find((candidate) => candidate.id === userId);
    if (user) user.emailVerified = true;
  });
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<void> {
  await delay(300);
  assert(input.fullName.trim(), "Enter your full name.");
  mutateDatabase((draft) => {
    const user = draft.users.find((candidate) => candidate.id === userId);
    if (user) { user.fullName = input.fullName.trim(); user.phone = input.phone.trim(); user.jobTitle = input.jobTitle.trim(); }
  });
}

export async function updateAvatar(userId: string, _orgId: string | null, blob: Blob | null, _previous: string): Promise<string> {
  await delay(300);
  const dataUrl = blob ? await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("That image could not be read.")); r.readAsDataURL(blob); }) : "";
  mutateDatabase((draft) => {
    const user = draft.users.find((candidate) => candidate.id === userId);
    if (user) user.avatarPath = dataUrl;
  });
  return dataUrl;
}

/** The mock backend never requires email confirmation, so there is nothing to resend. */
export async function resendSignupEmail(_email: string): Promise<void> {
  await delay(400);
}

export async function resetDemoData(): Promise<void> {
  await delay(260);
  resetDemoDatabase();
}
