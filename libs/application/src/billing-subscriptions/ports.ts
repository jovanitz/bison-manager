import type { BillingEvent, Subscription } from '@acme/domain';

/**
 * Per-org subscription state + the usage counters the entitlement guards
 * need (ADR-0016). Subscriptions store FACTS; phase is always derived. The
 * store is written at org birth (atomically with the org — an infra concern),
 * by the staff levers, and by the lazy trial-expiry recording.
 */

export type SubscriptionStore = {
  readonly findByAccount: (accountId: string) => Promise<Subscription | null>;
  /** Upsert; the audit event commits in the same transaction. */
  readonly save: (sub: Subscription, event: BillingEvent) => Promise<void>;
  /**
   * One-trial-per-creating-identity (anti farming): has this user ever been
   * the creator of a subscription?
   */
  readonly hasTrialConsumedByUser: (userId: string) => Promise<boolean>;
  /**
   * CAS: record `subscription.trial-expired` exactly once — returns true iff
   * THIS call recorded it (concurrent observers emit one event, not N).
   */
  readonly recordTrialExpired: (
    subscriptionId: string,
    event: BillingEvent,
  ) => Promise<boolean>;
};

/** Usage counters for limit checks — counted by the adapter, never cached. */
export type EntitlementUsageReader = {
  readonly countMembers: (accountId: string) => Promise<number>;
  /** Orgs OWNED by the user whose subscription sits on `planKey` (per-plan counting, ADR D2). */
  readonly countOwnedOrgsOnPlan: (
    userId: string,
    planKey: string,
  ) => Promise<number>;
};

/** The account facts a guard needs — staff accounts are exempt from billing. */
export type BillingAccountRef = {
  readonly accountId: string;
  readonly kind: 'staff' | 'customer';
};
