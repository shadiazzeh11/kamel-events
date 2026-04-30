/**
 * Format a number with locale-appropriate thousands separators
 * (e.g. 12345 → "12,345" in en-US).
 *
 * Lives in its own module because both the header cards and the
 * top-users table need it, and inlining the call would mean the
 * choice of separator behavior gets duplicated. If we ever want
 * to render shorter forms ("12.3k"), this is the one place to
 * change.
 */
export function formatCount(n: number): string {
  return n.toLocaleString();
}
