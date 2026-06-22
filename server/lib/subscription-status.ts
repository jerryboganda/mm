/**
 * Single source of truth for whether a user's subscription grants access.
 *
 * A subscription only counts as active when its stored status is
 * `active`/`trialing` AND its expiry timestamp (if present) is still in the
 * future. This prevents the stale-"active" bug where a user whose
 * subscription has lapsed (expired, or cancelled at period end) keeps full
 * access because the stored `subscription_status` column was never flipped to
 * "expired".
 */

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Returns true only when the subscription is genuinely active right now.
 *
 * @param status     The stored subscription status.
 * @param expiresAt  The subscription expiry (Date, ISO string, or null).
 * @param now        Injectable clock for testing. Defaults to the current time.
 */
export function isSubscriptionActive(
  status: string | null | undefined,
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!status || !ACTIVE_STATUSES.has(status)) return false;
  if (expiresAt == null) return true; // active with no expiry -> still active
  const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return true; // unparseable -> don't lock out
  return exp.getTime() > now.getTime();
}

/**
 * Normalises the stored status into the effective status the client should
 * see. An `active`/`trialing` subscription whose expiry has passed is reported
 * as `expired`; every other status is passed through unchanged.
 */
export function effectiveSubscriptionStatus(
  status: string | null | undefined,
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  const raw = status ?? "none";
  if (ACTIVE_STATUSES.has(raw) && !isSubscriptionActive(raw, expiresAt, now)) {
    return "expired";
  }
  return raw;
}
