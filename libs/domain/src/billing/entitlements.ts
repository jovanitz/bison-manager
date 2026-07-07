import { type Result, err, ok } from '@acme/shared';
import { invalidPlanFeature } from './errors';
import type { BillingDomainError } from './errors';

/**
 * The closed set of premium features a plan can grant (ADR-0016). Same shape
 * as `ACCESS_ACTIONS`, deny-by-default: a feature not in this union cannot be
 * expressed, let alone sold. The vocabulary is the contract — creating a plan
 * combines existing capabilities; it cannot invent functionality.
 *
 * DELIBERATELY DISJOINT from `ACCESS_ACTIONS` (spec-enforced): roles say *who
 * inside the org* may act; the plan says *what the org bought*. A use case
 * checks both, authz first.
 */
export const PLAN_FEATURES = [
  'reports.advanced',
  'reports.scheduled',
  'export.csv',
  'export.pdf',
  'branding.custom',
  'branding.domain',
  'audit.export',
  'audit.retention-1y',
  'members.bulk-import',
  'api.access',
  'integrations.whatsapp',
  'support.priority',
] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];

/**
 * Growth ceilings; `null` = unlimited. Limits gate *growth mutations only* —
 * never evict, never auto-repair. Two named limits, not a generic engine: a
 * new limit is a new field, compile-time visible at every check site.
 */
export type PlanLimits = {
  readonly maxOrganizationsOwned: number | null;
  readonly maxMembersPerOrg: number | null;
};

export type PlanEntitlements = {
  readonly limits: PlanLimits;
  readonly features: ReadonlyArray<PlanFeature>;
};

/** Boundary validation: narrow a raw string into the closed feature union. */
export const parsePlanFeature = (
  raw: string,
): Result<PlanFeature, BillingDomainError> => {
  const match = PLAN_FEATURES.find((feature) => feature === raw);
  if (!match) {
    return err(invalidPlanFeature(`Unknown plan feature "${raw}".`));
  }
  return ok(match);
};
