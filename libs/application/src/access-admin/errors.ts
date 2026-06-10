import { defineError, type TaggedError } from '@acme/shared';
import type { AccessUseCaseError } from '../access/errors';

export const accountNotFound = defineError('app/account-not-found');
export const accountAlreadyDisabled = defineError(
  'app/account-already-disabled',
);
export const membershipNotFound = defineError('app/membership-not-found');
export const sessionNotFound = defineError('app/session-not-found');
export const sessionAlreadyRevoked = defineError('app/session-already-revoked');

export type AccessAdminUseCaseError =
  | AccessUseCaseError
  | TaggedError<'app/account-not-found'>
  | TaggedError<'app/account-already-disabled'>
  | TaggedError<'app/membership-not-found'>
  | TaggedError<'app/session-not-found'>
  | TaggedError<'app/session-already-revoked'>;
