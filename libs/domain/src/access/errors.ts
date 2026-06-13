import { defineError, type TaggedError } from '@acme/shared';

/**
 * Domain errors for the access module (authorization core).
 *
 * Note what is NOT here: "access denied". A denial is a valid policy
 * *decision* (see policy/evaluate.ts), not a rule violation. These errors are
 * for malformed inputs and illegal state transitions on access entities.
 */
export const invalidAccessId = defineError('domain/invalid-access-id');
export const invalidAccessAction = defineError('domain/invalid-access-action');
export const invalidAccessScope = defineError('domain/invalid-access-scope');
export const invalidGrantReason = defineError('domain/invalid-grant-reason');
export const invalidGrantExpiry = defineError('domain/invalid-grant-expiry');
export const grantNotActive = defineError('domain/grant-not-active');
export const grantNotExpired = defineError('domain/grant-not-expired');
export const invalidSessionPolicy = defineError(
  'domain/invalid-session-policy',
);

export type AccessDomainError =
  | TaggedError<'domain/invalid-access-id'>
  | TaggedError<'domain/invalid-access-action'>
  | TaggedError<'domain/invalid-access-scope'>
  | TaggedError<'domain/invalid-grant-reason'>
  | TaggedError<'domain/invalid-grant-expiry'>
  | TaggedError<'domain/grant-not-active'>
  | TaggedError<'domain/grant-not-expired'>
  | TaggedError<'domain/invalid-session-policy'>;
