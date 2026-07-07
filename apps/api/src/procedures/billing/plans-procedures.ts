import { z } from 'zod';
import type { BillingPlansUseCases } from '@acme/application';
import { defineApiProcedure } from '../../rpc/procedure';
import type { ApiProcedure } from '../../rpc/procedure';
import {
  featuresSchema,
  limitsSchema,
  planChangesSchema,
  priceSchema,
  reasonSchema,
  toPlanChanges,
} from './schemas';

const planTarget = z
  .object({ planId: z.string().min(1), reason: reasonSchema })
  .strict();

/** Register a new plan: the free-form catalog lever (ADR-0016 D6). */
const plansCreate = (plans: BillingPlansUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'plans.create',
    summary:
      'Register a new plan: entitlements, trial months, optional price (null ' +
      '= undecided). The key is a stable unique slug customers never see.',
    action: 'plans.manage',
    input: z
      .object({
        key: z.string().min(1).max(60),
        displayName: z.string().min(1).max(80),
        internalNote: z.string().min(1).max(500),
        visibility: z.enum(['public', 'hidden']),
        price: priceSchema,
        trialMonths: z.number().int().min(0),
        limits: limitsSchema,
        features: featuresSchema,
        reason: reasonSchema,
      })
      .strict(),
    handler: ({ actor, input }) =>
      plans.createPlan({
        actor,
        input: {
          key: input.key,
          displayName: input.displayName,
          internalNote: input.internalNote,
          visibility: input.visibility,
          entitlements: { limits: input.limits, features: input.features },
          trialMonths: input.trialMonths,
          price: input.price,
        },
        reason: input.reason,
      }),
  });

/** The blast-radius instrument — staff confirm against it before an edit. */
const plansPreview = (plans: BillingPlansUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'plans.preview',
    summary:
      'Preview the blast radius of a plan edit before committing: subscriber ' +
      'count, how many orgs would go over-limit or lose a feature.',
    action: 'plans.manage',
    input: z
      .object({ planId: z.string().min(1), changes: planChangesSchema })
      .strict(),
    handler: ({ actor, input }) =>
      plans.previewPlanUpdate({
        actor,
        planId: input.planId,
        changes: toPlanChanges(input.changes),
      }),
  });

/** The live mass-edit (ADR-0016 D3), CAS-guarded by the version staff saw. */
const plansUpdate = (plans: BillingPlansUseCases): ApiProcedure =>
  defineApiProcedure({
    name: 'plans.update',
    summary:
      'Edit a plan — entitlement changes propagate LIVE to every subscriber. ' +
      'CAS-guarded by expectedVersion; audited with full before/after terms.',
    action: 'plans.manage',
    input: z
      .object({
        planId: z.string().min(1),
        changes: planChangesSchema,
        expectedVersion: z.number().int().min(1),
        reason: reasonSchema,
      })
      .strict(),
    handler: ({ actor, input }) =>
      plans.updatePlan({
        actor,
        planId: input.planId,
        changes: toPlanChanges(input.changes),
        expectedVersion: input.expectedVersion,
        reason: input.reason,
      }),
  });

/**
 * The staff plan-catalog administration (ADR-0016) — all gated by
 * `plans.manage` (owner preset only in v1: hidden plan names encode who got
 * special terms). The declared `action` is registry metadata; every use case
 * authorizes itself against the platform scope.
 */
export const createPlansProcedures = (
  plans: BillingPlansUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'plans.list',
    summary:
      'List the FULL plan catalog — hidden and retired included. Staff-only: ' +
      'hidden plan names encode who got special terms.',
    action: 'plans.manage',
    input: z.object({}).strict(),
    handler: ({ actor }) => plans.listPlans({ actor }),
  }),
  plansCreate(plans),
  plansPreview(plans),
  plansUpdate(plans),
  defineApiProcedure({
    name: 'plans.retire',
    summary:
      'Retire a plan — never delete: frozen and closed to ALL new ' +
      'subscriptions, even staff. The default plan cannot be retired.',
    action: 'plans.manage',
    input: planTarget,
    handler: ({ actor, input }) => plans.retirePlan({ actor, ...input }),
  }),
  defineApiProcedure({
    name: 'plans.reset',
    summary:
      'Restore a live plan to its code floor (DEFAULT_PLANS). A reset is a ' +
      'mass live-edit in disguise: same audit payload and CAS gate as update.',
    action: 'plans.manage',
    input: planTarget,
    handler: ({ actor, input }) => plans.resetPlan({ actor, ...input }),
  }),
  defineApiProcedure({
    name: 'plans.setDefault',
    summary:
      'Move the singular default-for-new-orgs marker to an active, public ' +
      'plan. Audited as billing.default-plan-changed.',
    action: 'plans.manage',
    input: planTarget,
    handler: ({ actor, input }) => plans.setDefaultPlan({ actor, ...input }),
  }),
  defineApiProcedure({
    name: 'plans.subscribers',
    summary:
      "List a plan's subscribed orgs (accountId, since when) — the minimum " +
      'staff instrument for edits, appeasement and cleanup.',
    action: 'plans.manage',
    input: z.object({ planId: z.string().min(1) }).strict(),
    handler: ({ actor, input }) =>
      plans.listSubscribers({ actor, planId: input.planId }),
  }),
];
