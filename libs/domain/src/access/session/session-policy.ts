import { type Result, err, ok } from '@acme/shared';
import { invalidSessionPolicy } from '../errors';
import type { AccessDomainError } from '../errors';

/**
 * Session lifetime policy — two clocks per session, whichever ends first:
 * - idle (sliding): each authenticated request pushes expiry to now + idle.
 * - absolute: anchored at login (createdAt), never slides.
 *
 * The policy is per account kind: staff (owner/support) sessions are short;
 * customer sessions are lax. Kind is NOT a role — it grants nothing; it only
 * parametrizes session hygiene. Defaults below are editable at runtime by
 * whoever holds `settings.update`, inside the hard bounds.
 */
export type AccountKind = 'customer' | 'staff';

export type AccessSessionPolicy = {
  readonly idleTtlMs: number;
  readonly maxLifetimeMs: number;
};

export type AccessSessionPolicies = Readonly<
  Record<AccountKind, AccessSessionPolicy>
>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const ACCESS_SESSION_POLICY_DEFAULTS: AccessSessionPolicies = {
  customer: { idleTtlMs: 24 * HOUR_MS, maxLifetimeMs: 72 * HOUR_MS },
  staff: { idleTtlMs: 30 * MINUTE_MS, maxLifetimeMs: 12 * HOUR_MS },
};

/** Hard bounds for the runtime-editable policy. */
export const ACCESS_SESSION_IDLE_MIN_MS = 5 * MINUTE_MS;
export const ACCESS_SESSION_LIFETIME_MAX_MS = 30 * DAY_MS;

/** Skip sliding writes when the extension would be smaller than this. */
export const ACCESS_SESSION_SLIDE_THRESHOLD_MS = 5 * MINUTE_MS;

/**
 * Concurrent-session cap per membership: registering session N+1 revokes the
 * least-recently-seen one (audited). Bounds data growth and abuse.
 */
export const ACCESS_SESSION_MAX_CONCURRENT = 5;

/**
 * Dead sessions (revoked/expired) are purged after this many days — the
 * audit trail keeps the history. Mirrored by the pg_cron purge default.
 *
 * Time authority note: expiry math runs on the API clock (NTP assumed across
 * instances); only the punctual sweeps (pg_cron) use the database clock,
 * where second-level skew is harmless.
 */
export const ACCESS_SESSION_PURGE_AFTER_DAYS = 30;

/** Pending invitations expire after this many days. */
export const ACCESS_INVITATION_TTL_DAYS = 7;

const validatePolicy = (
  kind: AccountKind,
  policy: AccessSessionPolicy,
): AccessDomainError | null => {
  if (policy.idleTtlMs < ACCESS_SESSION_IDLE_MIN_MS) {
    return invalidSessionPolicy(
      `${kind}: idle TTL must be at least ${ACCESS_SESSION_IDLE_MIN_MS} ms.`,
    );
  }
  if (policy.maxLifetimeMs > ACCESS_SESSION_LIFETIME_MAX_MS) {
    return invalidSessionPolicy(
      `${kind}: max lifetime must be at most ${ACCESS_SESSION_LIFETIME_MAX_MS} ms.`,
    );
  }
  if (policy.idleTtlMs > policy.maxLifetimeMs) {
    return invalidSessionPolicy(
      `${kind}: idle TTL cannot exceed the max lifetime.`,
    );
  }
  return null;
};

/** Boundary validation: external input becomes a policy set only through here. */
export const makeAccessSessionPolicies = (raw: {
  readonly customer: AccessSessionPolicy;
  readonly staff: AccessSessionPolicy;
}): Result<AccessSessionPolicies, AccessDomainError> => {
  for (const kind of ['customer', 'staff'] as const) {
    const invalid = validatePolicy(kind, raw[kind]);
    if (invalid) return err(invalid);
  }
  if (raw.staff.idleTtlMs > raw.customer.idleTtlMs) {
    return err(
      invalidSessionPolicy('staff idle TTL cannot exceed the customer one.'),
    );
  }
  if (raw.staff.maxLifetimeMs > raw.customer.maxLifetimeMs) {
    return err(
      invalidSessionPolicy(
        'staff max lifetime cannot exceed the customer one.',
      ),
    );
  }
  return ok({ customer: raw.customer, staff: raw.staff });
};

const toMs = (iso: string): number => new Date(iso).getTime();

/** The dual-clock expiry: min(reference + idle, createdAt + max). */
export const accessSessionExpiryFrom = (
  policy: AccessSessionPolicy,
  createdAt: string,
  referenceAt: string,
): string =>
  new Date(
    Math.min(
      toMs(referenceAt) + policy.idleTtlMs,
      toMs(createdAt) + policy.maxLifetimeMs,
    ),
  ).toISOString();

/**
 * Sliding renewal. Returns the new expiry, or `null` when nothing should be
 * written: the session is already dead (never resurrect), the absolute cap
 * makes the slide pointless, or the extension is below the write threshold.
 */
export const slideAccessSessionExpiry = (input: {
  readonly session: {
    readonly createdAt: string;
    readonly expiresAt: string;
  };
  readonly policy: AccessSessionPolicy;
  readonly now: string;
}): string | null => {
  const { session, policy, now } = input;
  if (toMs(session.expiresAt) <= toMs(now)) return null;
  const candidate = accessSessionExpiryFrom(policy, session.createdAt, now);
  if (
    toMs(candidate) - toMs(session.expiresAt) <
    ACCESS_SESSION_SLIDE_THRESHOLD_MS
  ) {
    return null;
  }
  return candidate;
};
