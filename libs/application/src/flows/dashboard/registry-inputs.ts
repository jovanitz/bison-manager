import { z } from 'zod';

/** Zod input schemas for the dashboard flow registry (kept out of registry.ts
 * so the catalog itself stays under the file-length budget). */
export const empty = z.object({});
export const accountIdInput = z.object({ accountId: z.string() });
export const grantInput = z.object({
  accountId: z.string(),
  membershipId: z.string(),
  action: z.string(),
  scope: z.string(),
});
export const inviteInput = z.object({
  accountId: z.string(),
  email: z.string().email(),
});
export const blockInput = z.object({
  subject: z.enum(['org', 'identity']),
  id: z.string(),
  blocked: z.boolean(),
});
const permissionsInput = z.array(
  z.object({ action: z.string(), scope: z.string() }),
);
export const createRoleInput = z.object({
  name: z.string(),
  permissions: permissionsInput,
});
export const updateRoleInput = z.object({
  roleId: z.string(),
  name: z.string(),
  permissions: permissionsInput,
});
export const deleteRoleInput = z.object({ roleId: z.string() });
export const assignRolesInput = z.object({
  membershipId: z.string(),
  roleIds: z.array(z.string()),
});
export const updateTemplateInput = z.object({
  key: z.string(),
  name: z.string(),
  permissions: permissionsInput,
});
export const resetTemplateInput = z.object({ key: z.string() });
export const adminAccountInput = z.object({
  action: z.enum(['disable', 'enable', 'promote']),
  accountId: z.string(),
  // Account-admin levers don't yet collect an audited reason from the caller —
  // the Directory dispatches them without one. Deliberate carve-out until we
  // capture it here the way Plans did (docs/ai/operations.md).
  reason: z.string().optional(), // harness:reason-optional-ok
});
export const membershipInput = z.object({ membershipId: z.string() });
export const sessionIdInput = z.object({ sessionId: z.string() });
// Billing (ADR-0016) — mirrors the API's plans.* / billing.* zod vocabulary.
const planLimits = z.object({
  maxOrganizationsOwned: z.number().int().nullable(),
  maxMembersPerOrg: z.number().int().nullable(),
});
const planFeatures = z.array(z.string());
const planPrice = z
  .object({
    amountCents: z.number().int().positive(),
    currency: z.enum(['MXN', 'USD']),
    interval: z.enum(['month', 'year']),
  })
  .nullable();
const reason = z.string().min(1).max(500);
export const planChangesInput = z.object({
  displayName: z.string().min(1).max(80).optional(),
  internalNote: z.string().min(1).max(500).optional(),
  visibility: z.enum(['public', 'hidden']).optional(),
  entitlements: z
    .object({ limits: planLimits, features: planFeatures })
    .optional(),
  trialMonths: z.number().int().min(0).optional(),
  price: planPrice.optional(),
});
export const createPlanInput = z.object({
  key: z.string().min(1).max(60),
  displayName: z.string().min(1).max(80),
  internalNote: z.string().min(1).max(500),
  visibility: z.enum(['public', 'hidden']),
  price: planPrice,
  trialMonths: z.number().int().min(0),
  limits: planLimits,
  features: planFeatures,
  reason,
});
export const previewPlanInput = z.object({
  planId: z.string(),
  changes: planChangesInput,
});
export const updatePlanInput = z.object({
  planId: z.string(),
  changes: planChangesInput,
  expectedVersion: z.number().int().min(1),
  reason,
});
export const planTargetInput = z.object({ planId: z.string(), reason });
export const markPaidInput = z.object({
  accountId: z.string(),
  paidThrough: z.string().min(1),
  amountNote: z.string().min(1).max(200).optional(),
  reason,
});
export const extendTrialInput = z.object({
  accountId: z.string(),
  trialEndsAt: z.string().min(1),
  reason,
});
export const changePlanInput = z.object({
  accountId: z.string(),
  planId: z.string(),
  reason,
});
export const setOverrideInput = z.object({
  accountId: z.string(),
  overrides: z
    .object({
      limits: planLimits.optional(),
      features: planFeatures.optional(),
    })
    .nullable(),
  reason,
});
const sessionPolicyShape = z.object({
  idleTtlMs: z.number().int().positive(),
  maxLifetimeMs: z.number().int().positive(),
});
export const sessionPolicyInput = z.object({
  policies: z.object({
    customer: sessionPolicyShape,
    staff: sessionPolicyShape,
  }),
});
