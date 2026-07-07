import { defineError, type TaggedError } from '@acme/shared';
import type { BillingDomainError } from '@acme/domain';
import type { AccessUseCaseError } from '../access/errors';

/**
 * Billing denials are upsell-grade, never authorization-shaped (ADR-0016
 * Decision 5): `app/plan-limit-exceeded` maps to 409 and
 * `app/subscription-expired` to 402 — 403 stays reserved for
 * `app/access-denied`. A missing subscription is FAIL-CLOSED for growth
 * (`app/subscription-not-found`), never "no subscription = unlimited".
 */
export const subscriptionNotFound = defineError('app/subscription-not-found');
export const planLimitExceeded = defineError('app/plan-limit-exceeded');
export const featureNotInPlan = defineError('app/feature-not-in-plan');
/** Names the billing hold in BOTH `past_due` and `canceled` phases. */
export const subscriptionExpired = defineError('app/subscription-expired');
/** Retired plans are frozen — closed to ALL new subscriptions, even staff. */
export const planRetired = defineError('app/plan-retired');
/** No default plan for new orgs: org creation fails closed, never unlimited. */
export const defaultPlanMissing = defineError('app/default-plan-missing');

export type BillingSubscriptionsUseCaseError =
  | AccessUseCaseError
  | BillingDomainError
  | TaggedError<'app/subscription-not-found'>
  | TaggedError<'app/plan-limit-exceeded'>
  | TaggedError<'app/feature-not-in-plan'>
  | TaggedError<'app/subscription-expired'>
  | TaggedError<'app/plan-retired'>
  | TaggedError<'app/default-plan-missing'>
  | TaggedError<'app/reason-required'>
  | TaggedError<'app/plan-not-found'>;
