import { type Brand, type Result, err, ok } from '@acme/shared';
import {
  defaultPlanProtected,
  invalidBillingId,
  invalidPlanKey,
  invalidPlanName,
  invalidPlanPrice,
  invalidPlanTrial,
  planAlreadyRetired,
  planNotAssignable,
} from '../errors';
import type { BillingDomainError } from '../errors';
import type { PlanEntitlements } from '../entitlements';

export type PlanId = Brand<string, 'PlanId'>;

export const makePlanId = (raw: string): Result<PlanId, BillingDomainError> => {
  const value = raw.trim();
  if (value.length === 0) {
    return err(invalidBillingId('Billing ids must not be empty.'));
  }
  return ok(value as PlanId);
};

export type PlanCurrency = 'MXN' | 'USD';
export type PlanInterval = 'month' | 'year';

export type PlanPrice = {
  /** Integer cents, strictly positive — a free plan has `price: null`. */
  readonly amountCents: number;
  readonly currency: PlanCurrency;
  readonly interval: PlanInterval;
};

/** `retired` = frozen, closed to ALL new subscriptions (even staff). */
export type PlanStatus = 'active' | 'retired';
/** `hidden` + active = staff-assignable only — home of legacy/custom plans. */
export type PlanVisibility = 'public' | 'hidden';

export type Plan = {
  readonly id: PlanId;
  /** Stable slug, unique by store; customers only ever see `displayName`. */
  readonly key: string;
  readonly displayName: string;
  /** Why this plan exists and for whom — staff-facing, required (ADR-0016). */
  readonly internalNote: string;
  readonly status: PlanStatus;
  readonly visibility: PlanVisibility;
  /** Singular marker with write guards; see `markDefault` / `retirePlan`. */
  readonly isDefaultForNewOrgs: boolean;
  readonly entitlements: PlanEntitlements;
  /** Governs NEW subscriptions only; existing `trialEndsAt` are frozen. */
  readonly trialMonths: number;
  /** `null` = "price not decided yet" is first-class. */
  readonly price: PlanPrice | null;
  /** Stamped the FIRST time price goes null→set — the delinquency grace anchor. */
  readonly priceSetAt: string | null;
  /** Optimistic concurrency (starts at 1); bumped by every staff edit. */
  readonly version: number;
};

const PLAN_KEY_SHAPE = /^[a-z0-9-]+$/;

type PlanFields = {
  readonly displayName: string;
  readonly internalNote: string;
  readonly trialMonths: number;
  readonly price: PlanPrice | null;
};

/** Shared field validation for create/update; returns normalized fields. */
const validatePlanFields = (
  fields: PlanFields,
): Result<PlanFields, BillingDomainError> => {
  const displayName = fields.displayName.trim();
  const internalNote = fields.internalNote.trim();
  if (displayName.length === 0) {
    return err(invalidPlanName('A plan display name must not be empty.'));
  }
  if (internalNote.length === 0) {
    return err(invalidPlanName('A plan requires a non-empty internal note.'));
  }
  if (!Number.isInteger(fields.trialMonths) || fields.trialMonths < 0) {
    return err(invalidPlanTrial('trialMonths must be an integer >= 0.'));
  }
  if (
    fields.price !== null &&
    (!Number.isInteger(fields.price.amountCents) ||
      fields.price.amountCents <= 0)
  ) {
    return err(
      invalidPlanPrice('A plan price must be a positive integer of cents.'),
    );
  }
  return ok({ ...fields, displayName, internalNote });
};

export type CreatePlanInput = {
  readonly key: string;
  readonly displayName: string;
  readonly internalNote: string;
  readonly visibility: PlanVisibility;
  readonly entitlements: PlanEntitlements;
  readonly trialMonths: number;
  readonly price: PlanPrice | null;
};

export const createPlan = (
  input: CreatePlanInput,
  deps: { readonly ids: () => string; readonly now: string },
): Result<Plan, BillingDomainError> => {
  const id = makePlanId(deps.ids());
  if (!id.ok) return id;
  if (!PLAN_KEY_SHAPE.test(input.key)) {
    return err(
      invalidPlanKey('A plan key must be a non-empty [a-z0-9-] slug.'),
    );
  }
  const fields = validatePlanFields(input);
  if (!fields.ok) return fields;
  return ok({
    id: id.value,
    key: input.key,
    displayName: fields.value.displayName,
    internalNote: fields.value.internalNote,
    status: 'active',
    visibility: input.visibility,
    isDefaultForNewOrgs: false,
    entitlements: input.entitlements,
    trialMonths: fields.value.trialMonths,
    price: fields.value.price,
    priceSetAt: fields.value.price ? deps.now : null,
    version: 1,
  });
};

export type PlanChanges = {
  readonly displayName?: string;
  readonly internalNote?: string;
  readonly visibility?: PlanVisibility;
  readonly entitlements?: PlanEntitlements;
  readonly trialMonths?: number;
  readonly price?: PlanPrice | null;
};

/**
 * Staff edit — entitlement changes propagate LIVE to every subscriber
 * (ADR-0016 D3; the blast-radius preview lives in the application layer).
 * `key`, `status` and the default marker are deliberately not editable here.
 * `priceSetAt` is stamped exactly once, on the first null→set transition —
 * later price edits (or unset/re-set cycles) never move the grace anchor.
 */
export const updatePlan = (
  plan: Plan,
  changes: PlanChanges,
  now: string,
): Result<Plan, BillingDomainError> => {
  const price = changes.price === undefined ? plan.price : changes.price;
  const fields = validatePlanFields({
    displayName: changes.displayName ?? plan.displayName,
    internalNote: changes.internalNote ?? plan.internalNote,
    trialMonths: changes.trialMonths ?? plan.trialMonths,
    price,
  });
  if (!fields.ok) return fields;
  return ok({
    ...plan,
    displayName: fields.value.displayName,
    internalNote: fields.value.internalNote,
    visibility: changes.visibility ?? plan.visibility,
    entitlements: changes.entitlements ?? plan.entitlements,
    trialMonths: fields.value.trialMonths,
    price: fields.value.price,
    priceSetAt:
      plan.priceSetAt === null && price !== null ? now : plan.priceSetAt,
    version: plan.version + 1,
  });
};

/** Retire, never delete: frozen and closed to all new subscriptions. */
export const retirePlan = (plan: Plan): Result<Plan, BillingDomainError> => {
  if (plan.isDefaultForNewOrgs) {
    return err(
      defaultPlanProtected('The default plan for new orgs cannot be retired.'),
    );
  }
  if (plan.status === 'retired') {
    return err(planAlreadyRetired(`Plan "${plan.key}" is already retired.`));
  }
  return ok({ ...plan, status: 'retired' });
};

/** The default plan for new orgs must be public and active (ADR-0016). */
export const markDefault = (plan: Plan): Result<Plan, BillingDomainError> => {
  if (plan.status === 'retired' || plan.visibility === 'hidden') {
    return err(
      planNotAssignable('The default plan must be public and active.'),
    );
  }
  return ok({ ...plan, isDefaultForNewOrgs: true });
};
