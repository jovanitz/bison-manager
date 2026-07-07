import type { Result } from '@acme/shared';
import type { BillingDomainError } from '../errors';
import type { PlanEntitlements } from '../entitlements';
import { updatePlan } from './plan';
import type { Plan, PlanPrice, PlanVisibility } from './plan';

/**
 * A default plan definition — the code floor (ADR-0016; the `ROLE_TEMPLATES`
 * analog). Pure, version-controlled data: the immutable baseline a live plan
 * can be reset to. Seeding is idempotent (`on conflict do nothing` on `key`),
 * so a staff-edited live plan is never silently overwritten by a deploy.
 */
export type PlanSeed = {
  readonly key: string;
  readonly displayName: string;
  readonly internalNote: string;
  readonly visibility: PlanVisibility;
  readonly isDefaultForNewOrgs: boolean;
  readonly entitlements: PlanEntitlements;
  readonly trialMonths: number;
  readonly price: PlanPrice | null;
};

export const DEFAULT_PLANS: ReadonlyArray<PlanSeed> = [
  {
    key: 'free',
    displayName: 'Free',
    internalNote: 'The acquisition plan — every new org is born here.',
    visibility: 'public',
    isDefaultForNewOrgs: true,
    entitlements: {
      limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
      features: [],
    },
    trialMonths: 3,
    price: null,
  },
];

export const findPlanSeed = (key: string): PlanSeed | null =>
  DEFAULT_PLANS.find((seed) => seed.key === key) ?? null;

/**
 * Reset a live plan to its code floor. Restores the commercial terms
 * (displayName/internalNote/entitlements/trialMonths/price), keeping id, key,
 * status, visibility and the default marker; version bumps and the exactly-once
 * `priceSetAt` rule applies — a reset is a live mass-edit and gets the same
 * audit/preview gates as `updatePlan` in the application layer.
 */
export const resetPlanFromSeed = (
  plan: Plan,
  seed: PlanSeed,
  now: string,
): Result<Plan, BillingDomainError> =>
  updatePlan(
    plan,
    {
      displayName: seed.displayName,
      internalNote: seed.internalNote,
      entitlements: seed.entitlements,
      trialMonths: seed.trialMonths,
      price: seed.price,
    },
    now,
  );
