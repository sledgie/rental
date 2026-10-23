/** Small helpers that make the mock services feel like real network calls. */
export const delay = (ms = 520): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function simulate<T>(work: () => T, ms = 520): Promise<T> {
  await delay(ms);
  return work();
}

export function fail(message: string, ms = 320): Promise<never> {
  return delay(ms).then(() => {
    throw new Error(message);
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Accepts "invitation-123" / "activity-123" ids and generates new unique ids. */
export function makeId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${random}`;
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
