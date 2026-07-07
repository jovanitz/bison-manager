import { z } from 'zod';
import type { BillingSubscriptionsUseCases } from '@acme/application';
import { defineApiProcedure } from '../../rpc/procedure';
import type { ApiProcedure } from '../../rpc/procedure';
import { overridesSchema, reasonSchema, toOverrides } from './schemas';

const leverTarget = z
  .object({ accountId: z.string().min(1), reason: reasonSchema })
  .strict();

/** "Paid through DATE" — the manual-era substitute for a payment webhook. */
const billingMarkPaid = (
  subscriptions: BillingSubscriptionsUseCases,
): ApiProcedure =>
  defineApiProcedure({
    name: 'billing.markPaid',
    summary:
      'Staff lever: mark an org paid through an absolute DATE (manual-era ' +
      'payment webhook). Optional amount note feeds the collection ledger.',
    action: 'plans.manage',
    input: leverTarget.extend({
      paidThrough: z.string().min(1),
      amountNote: z.string().min(1).max(200).optional(),
    }),
    handler: ({ actor, input }) =>
      subscriptions.markPaid({
        actor,
        accountId: input.accountId,
        paidThrough: input.paidThrough,
        reason: input.reason,
        ...(input.amountNote !== undefined
          ? { amountNote: input.amountNote }
          : {}),
      }),
  });

/** The per-org exception valve — one override, not a new plan. */
const billingSetOverride = (
  subscriptions: BillingSubscriptionsUseCases,
): ApiProcedure =>
  defineApiProcedure({
    name: 'billing.setOverride',
    summary:
      'Staff lever: set (or clear with null) the per-org entitlement ' +
      'exception — "you keep 25 seats" is one override, not a new plan.',
    action: 'plans.manage',
    input: leverTarget.extend({ overrides: overridesSchema }),
    handler: ({ actor, input }) =>
      subscriptions.setOverride({
        actor,
        accountId: input.accountId,
        overrides: toOverrides(input.overrides),
        reason: input.reason,
      }),
  });

/**
 * Per-org subscription state + the staff manual levers (ADR-0016 Decision 5)
 * — the bridge until payments exist. Levers are ABSOLUTE setters ("paid
 * through DATE"), idempotent under retries, reason mandatory: during the
 * manual-billing era the audit trail IS the accounting. All levers are gated
 * by `plans.manage`; the summary read by `billing.read` (customer `own`,
 * delegable — the one procedure a held account must always reach).
 */
export const createBillingProcedures = (
  subscriptions: BillingSubscriptionsUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'billing.summary',
    summary:
      "Read one org's billing state: plan, derived phase, seats, trial/paid " +
      'dates, hold flag. Reachable under a billing hold — the pay moment.',
    action: 'billing.read',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      subscriptions.getBillingSummary({ actor, accountId: input.accountId }),
  }),
  billingMarkPaid(subscriptions),
  defineApiProcedure({
    name: 'billing.extendTrial',
    summary:
      "Staff lever: set an org's trial end to an absolute DATE — the ONLY " +
      'way a new trial is ever granted (plan changes never regrant one).',
    action: 'plans.manage',
    input: leverTarget.extend({ trialEndsAt: z.string().min(1) }),
    handler: ({ actor, input }) =>
      subscriptions.extendTrial({
        actor,
        accountId: input.accountId,
        trialEndsAt: input.trialEndsAt,
        reason: input.reason,
      }),
  }),
  defineApiProcedure({
    name: 'billing.changePlan',
    summary:
      'Staff lever: move an org to another plan (staff-only in v1). Retired ' +
      'plans are refused; hidden+active is assignable (legacy/custom home).',
    action: 'plans.manage',
    input: leverTarget.extend({ planId: z.string().min(1) }),
    handler: ({ actor, input }) =>
      subscriptions.changePlan({
        actor,
        accountId: input.accountId,
        planId: input.planId,
        reason: input.reason,
      }),
  }),
  billingSetOverride(subscriptions),
];
