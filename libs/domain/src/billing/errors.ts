import { defineError, type TaggedError } from '@acme/shared';

/**
 * Domain errors for the billing module (plans, subscriptions, entitlements —
 * ADR-0016).
 *
 * Note what is NOT here: "limit exceeded" or "subscription expired". Those are
 * valid *decisions* of the pure entitlement checks (see policy/check.ts), not
 * rule violations — the same denial-is-a-decision philosophy as the access
 * policy core. These errors are for malformed inputs and illegal state
 * transitions on billing entities.
 */
export const invalidBillingId = defineError('domain/invalid-billing-id');
export const invalidPlanFeature = defineError('domain/invalid-plan-feature');
export const invalidPlanKey = defineError('domain/invalid-plan-key');
export const invalidPlanName = defineError('domain/invalid-plan-name');
export const invalidPlanTrial = defineError('domain/invalid-plan-trial');
export const invalidPlanPrice = defineError('domain/invalid-plan-price');
export const invalidBillingDate = defineError('domain/invalid-billing-date');
export const defaultPlanProtected = defineError(
  'domain/default-plan-protected',
);
export const planAlreadyRetired = defineError('domain/plan-already-retired');
export const planNotAssignable = defineError('domain/plan-not-assignable');
/** Money must be a safe integer of minor units (ADR-0018) — never a float. */
export const invalidMoney = defineError('domain/invalid-money');
/** Arithmetic across two currencies — never combined (ADR-0018). */
export const currencyMismatch = defineError('domain/currency-mismatch');
/** Tax rate must be a non-negative integer of basis points (ADR-0018). */
export const invalidTaxRate = defineError('domain/invalid-tax-rate');
/** Billing policy numbers (grace days, dormant window) must be non-negative
 *  integers (ADR-0018). */
export const invalidBillingPolicy = defineError(
  'domain/invalid-billing-policy',
);

export type BillingDomainError =
  | TaggedError<'domain/invalid-billing-id'>
  | TaggedError<'domain/invalid-plan-feature'>
  | TaggedError<'domain/invalid-plan-key'>
  | TaggedError<'domain/invalid-plan-name'>
  | TaggedError<'domain/invalid-plan-trial'>
  | TaggedError<'domain/invalid-plan-price'>
  | TaggedError<'domain/invalid-billing-date'>
  | TaggedError<'domain/default-plan-protected'>
  | TaggedError<'domain/plan-already-retired'>
  | TaggedError<'domain/plan-not-assignable'>
  | TaggedError<'domain/invalid-money'>
  | TaggedError<'domain/currency-mismatch'>
  | TaggedError<'domain/invalid-tax-rate'>
  | TaggedError<'domain/invalid-billing-policy'>;
