import { z } from 'zod';
import { PLAN_FEATURES } from '@acme/domain';
import type { PlanChanges, PlanEntitlements } from '@acme/domain';

/**
 * Shared zod vocabulary of the billing procedures (ADR-0016). Everything is
 * `.strict()` and mirrors the domain's closed unions: features come from
 * `PLAN_FEATURES` (deny-by-default — an unknown feature cannot even be
 * expressed at the boundary), price/limits mirror `PlanPrice`/`PlanLimits`.
 */
export const priceSchema = z
  .object({
    amountCents: z.number().int().positive(),
    currency: z.enum(['MXN', 'USD']),
    interval: z.enum(['month', 'year']),
  })
  .strict()
  .nullable();

export const limitsSchema = z
  .object({
    maxOrganizationsOwned: z.number().int().nullable(),
    maxMembersPerOrg: z.number().int().nullable(),
  })
  .strict();

export const featuresSchema = z.array(z.enum(PLAN_FEATURES)).max(50);

export const entitlementsSchema = z
  .object({ limits: limitsSchema, features: featuresSchema })
  .strict();

/** Staff levers and plan mutations demand a reason (audited verbatim). */
export const reasonSchema = z.string().min(1).max(500);

/** The staff-editable subset of a plan — mirrors the domain's `PlanChanges`. */
export const planChangesSchema = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    internalNote: z.string().min(1).max(500).optional(),
    visibility: z.enum(['public', 'hidden']).optional(),
    entitlements: entitlementsSchema.optional(),
    trialMonths: z.number().int().min(0).optional(),
    price: priceSchema.optional(),
  })
  .strict();

type PlanChangesInput = z.infer<typeof planChangesSchema>;

/** Drop the zod-optional `undefined`s (exactOptionalPropertyTypes). */
export const toPlanChanges = (raw: PlanChangesInput): PlanChanges => ({
  ...(raw.displayName !== undefined ? { displayName: raw.displayName } : {}),
  ...(raw.internalNote !== undefined ? { internalNote: raw.internalNote } : {}),
  ...(raw.visibility !== undefined ? { visibility: raw.visibility } : {}),
  ...(raw.entitlements !== undefined ? { entitlements: raw.entitlements } : {}),
  ...(raw.trialMonths !== undefined ? { trialMonths: raw.trialMonths } : {}),
  ...(raw.price !== undefined ? { price: raw.price } : {}),
});

/** The per-org exception valve: partial entitlements, or null to clear. */
export const overridesSchema = z
  .object({
    limits: limitsSchema.optional(),
    features: featuresSchema.optional(),
  })
  .strict()
  .nullable();

type OverridesInput = z.infer<typeof overridesSchema>;

export const toOverrides = (
  raw: OverridesInput,
): Partial<PlanEntitlements> | null =>
  raw === null
    ? null
    : {
        ...(raw.limits !== undefined ? { limits: raw.limits } : {}),
        ...(raw.features !== undefined ? { features: raw.features } : {}),
      };
