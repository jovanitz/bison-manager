import type { BillingEvent, Plan, PlanEntitlements } from '@acme/domain';

/**
 * Staff-side plan-catalog administration (ADR-0016). Plans are staff-editable
 * rows with a code floor (`DEFAULT_PLANS`); edits propagate LIVE to every
 * subscriber, which is why the write path carries three instruments:
 *
 * - optimistic concurrency (`expectedVersion`) — two staff editing the same
 *   plan must never silently lose an update;
 * - a blast-radius preview (`previewImpact`) shown BEFORE an edit commits;
 * - audit events with full before/after payloads, committed atomically with
 *   the write (the only way the legacy playbook can reconstruct old terms).
 */

/** Blast radius of applying `next` entitlements to a plan's subscribers. */
export type PlanImpactPreview = {
  readonly subscribers: number;
  readonly wouldGoOverLimit: number;
  readonly wouldLoseFeature: number;
};

/** One subscribed org, for the `plans.subscribers` staff instrument. */
export type PlanSubscriberEntry = {
  readonly accountId: string;
  readonly since: string;
};

/**
 * Catalog store. `savePlan` persists iff the stored version equals
 * `expectedVersion` (`null` = create; the key must be free) and commits the
 * audit event in the same transaction; `'conflict'` maps to
 * `app/plan-concurrently-modified` / `app/plan-key-taken` in the use case.
 */
export type PlanCatalogStore = {
  readonly listPlans: () => Promise<readonly Plan[]>;
  readonly findPlanById: (planId: string) => Promise<Plan | null>;
  readonly findPlanByKey: (key: string) => Promise<Plan | null>;
  readonly findDefaultPlan: () => Promise<Plan | null>;
  readonly countSubscribers: (planId: string) => Promise<number>;
  readonly listSubscribers: (
    planId: string,
  ) => Promise<readonly PlanSubscriberEntry[]>;
  readonly previewImpact: (
    planId: string,
    next: PlanEntitlements,
  ) => Promise<
    Pick<PlanImpactPreview, 'wouldGoOverLimit' | 'wouldLoseFeature'>
  >;
  readonly savePlan: (
    plan: Plan,
    expectedVersion: number | null,
    event: BillingEvent,
  ) => Promise<'ok' | 'conflict'>;
  /** Move the singular default marker; event committed atomically. */
  readonly setDefaultPlan: (
    planId: string,
    event: BillingEvent,
  ) => Promise<void>;
};
