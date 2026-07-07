import { defineError, type TaggedError } from '@acme/shared';
import type { BillingDomainError } from '@acme/domain';
import type { AccessUseCaseError } from '../access/errors';

/**
 * Errors of the staff plan-catalog administration (ADR-0016). Billing domain
 * errors pass through untouched (`domain/default-plan-protected`,
 * `domain/plan-already-retired`, …): illegal plan transitions are business
 * rules, not orchestration failures. Authorization denials keep the uniform
 * `app/access-denied` shape — billing errors never masquerade as 403.
 */
export const planNotFound = defineError('app/plan-not-found');
export const planKeyTaken = defineError('app/plan-key-taken');
/** The CAS instrument: two staff editing the same plan must never silently
 * lose an update on the highest-blast-radius row in the system. */
export const planConcurrentlyModified = defineError(
  'app/plan-concurrently-modified',
);
/** A live plan whose `key` has no code seed has no floor to reset to. */
export const planSeedMissing = defineError('app/plan-seed-missing');
/** Staff levers demand a reason — the impersonation-grant precedent. During
 * the manual-billing era the audit trail IS the accounting. */
export const reasonRequired = defineError('app/reason-required');

export type BillingPlansUseCaseError =
  | AccessUseCaseError
  | BillingDomainError
  | TaggedError<'app/plan-not-found'>
  | TaggedError<'app/plan-key-taken'>
  | TaggedError<'app/plan-concurrently-modified'>
  | TaggedError<'app/plan-seed-missing'>
  | TaggedError<'app/reason-required'>;
