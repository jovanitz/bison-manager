import type { z } from 'zod';
import type {
  BillingGateway,
  PlanChangesDto,
  PlanOverridesDto,
} from '../../../access-client/billing-ports';
import type {
  markPaidInput,
  planChangesInput,
  setOverrideInput,
} from '../registry-inputs';

/**
 * Thin command wrappers over the `BillingGateway` — pure Result passthrough,
 * so the UI store and the MCP registry drive the exact same functions. Their
 * only logic is normalization: zod-optional fields parse as `T | undefined`,
 * which `exactOptionalPropertyTypes` refuses on the gateway's `?:` DTOs, so
 * the `undefined`s are dropped here (the API's schemas are `.strict()`).
 */
type Deps = { readonly billing: BillingGateway };

/** Drop the zod-optional `undefined`s from a parsed plan-changes payload. */
export const toPlanChanges = (
  raw: z.infer<typeof planChangesInput>,
): PlanChangesDto => ({
  ...(raw.displayName !== undefined ? { displayName: raw.displayName } : {}),
  ...(raw.internalNote !== undefined ? { internalNote: raw.internalNote } : {}),
  ...(raw.visibility !== undefined ? { visibility: raw.visibility } : {}),
  ...(raw.entitlements !== undefined ? { entitlements: raw.entitlements } : {}),
  ...(raw.trialMonths !== undefined ? { trialMonths: raw.trialMonths } : {}),
  ...(raw.price !== undefined ? { price: raw.price } : {}),
});

const toOverrides = (
  raw: z.infer<typeof setOverrideInput>['overrides'],
): PlanOverridesDto =>
  raw === null
    ? null
    : {
        ...(raw.limits !== undefined ? { limits: raw.limits } : {}),
        ...(raw.features !== undefined ? { features: raw.features } : {}),
      };

export const createPlan = (
  deps: Deps,
  input: Parameters<BillingGateway['createPlan']>[0],
) => deps.billing.createPlan(input);

export const previewPlanUpdate = (
  deps: Deps,
  input: {
    readonly planId: string;
    readonly changes: z.infer<typeof planChangesInput>;
  },
) =>
  deps.billing.previewPlanUpdate({
    planId: input.planId,
    changes: toPlanChanges(input.changes),
  });

export const updatePlan = (
  deps: Deps,
  input: {
    readonly planId: string;
    readonly changes: z.infer<typeof planChangesInput>;
    readonly expectedVersion: number;
    readonly reason: string;
  },
) =>
  deps.billing.updatePlan({
    planId: input.planId,
    changes: toPlanChanges(input.changes),
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });

export const retirePlan = (
  deps: Deps,
  input: { readonly planId: string; readonly reason: string },
) => deps.billing.retirePlan(input);

export const resetPlan = (
  deps: Deps,
  input: { readonly planId: string; readonly reason: string },
) => deps.billing.resetPlan(input);

export const setDefaultPlan = (
  deps: Deps,
  input: { readonly planId: string; readonly reason: string },
) => deps.billing.setDefaultPlan(input);

export const markPaid = (deps: Deps, input: z.infer<typeof markPaidInput>) =>
  deps.billing.markPaid({
    accountId: input.accountId,
    paidThrough: input.paidThrough,
    reason: input.reason,
    ...(input.amountNote !== undefined ? { amountNote: input.amountNote } : {}),
  });

export const extendTrial = (
  deps: Deps,
  input: {
    readonly accountId: string;
    readonly trialEndsAt: string;
    readonly reason: string;
  },
) => deps.billing.extendTrial(input);

export const changePlan = (
  deps: Deps,
  input: {
    readonly accountId: string;
    readonly planId: string;
    readonly reason: string;
  },
) => deps.billing.changePlan(input);

export const setOverride = (
  deps: Deps,
  input: z.infer<typeof setOverrideInput>,
) =>
  deps.billing.setOverride({
    accountId: input.accountId,
    overrides: toOverrides(input.overrides),
    reason: input.reason,
  });
