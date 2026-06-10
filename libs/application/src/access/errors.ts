import { defineError, type TaggedError } from '@acme/shared';
import type { AccessDomainError } from '@acme/domain';

/**
 * Access errors shared by every authorization-aware use case.
 *
 * `app/access-denied` is the *only* shape a denial ever takes when it leaves a
 * use case: adapters map it to 403, never leaking which rule failed beyond the
 * structured `reason` detail (which the audit trail and ops can read).
 */
export const accessDenied = defineError('app/access-denied');
export const accessActorNotFound = defineError('app/access-actor-not-found');

export type AccessUseCaseError =
  | AccessDomainError
  | TaggedError<'app/access-denied'>
  | TaggedError<'app/access-actor-not-found'>;
