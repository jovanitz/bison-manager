import type { AccessSessionPolicies, AccessSettingsUpdated } from '@acme/domain';

/**
 * Runtime-editable session policy (ADR-0010 + business-rules doc). `load`
 * falls back to the domain defaults when nothing was ever saved.
 *
 * `save` MUST persist, in ONE transaction: the new policies, the audit event,
 * and the immediate shrink of every live session
 * (`expires_at = least(current, last_seen + idle, created + max)` per kind).
 * Tightening therefore takes effect instantly; loosening is only ever gained
 * through later activity (slides) — never retroactively.
 */
export type AccessSessionSettings = {
  readonly policies: AccessSessionPolicies;
  /** Monotonic optimistic-locking version (1 = never saved / defaults). */
  readonly version: number;
};

export type AccessSessionPolicyStore = {
  readonly loadSessionPolicies: () => Promise<AccessSessionPolicies>;
  readonly loadSessionSettings: () => Promise<AccessSessionSettings>;
  /**
   * Persists settings + audit + the live-session shrink in ONE transaction,
   * guarded by the version: returns false (and writes nothing) when someone
   * else saved first.
   */
  readonly saveSessionPolicies: (
    policies: AccessSessionPolicies,
    event: AccessSettingsUpdated,
    expectedVersion: number,
  ) => Promise<boolean>;
};
