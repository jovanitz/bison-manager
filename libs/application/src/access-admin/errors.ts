import { defineError, type TaggedError } from '@acme/shared';
import type { AccessUseCaseError } from '../access/errors';

export const accountNotFound = defineError('app/account-not-found');
export const accountAlreadyDisabled = defineError(
  'app/account-already-disabled',
);
export const membershipNotFound = defineError('app/membership-not-found');
export const sessionNotFound = defineError('app/session-not-found');
export const sessionAlreadyRevoked = defineError('app/session-already-revoked');
export const accountAlreadyStaff = defineError('app/account-already-staff');
export const requiresStaffAccount = defineError('app/requires-staff-account');
export const accountNotDisabled = defineError('app/account-not-disabled');
export const notDelegableToCustomer = defineError(
  'app/not-delegable-to-customer',
);
/** An account must always keep at least one administrator (a membership
 * holding `permissions.update`); this change would leave it ungovernable. */
export const cannotOrphanAccount = defineError('app/cannot-orphan-account');

export type AccessAdminUseCaseError =
  | AccessUseCaseError
  | TaggedError<'app/account-not-found'>
  | TaggedError<'app/account-already-disabled'>
  | TaggedError<'app/membership-not-found'>
  | TaggedError<'app/session-not-found'>
  | TaggedError<'app/session-already-revoked'>
  | TaggedError<'app/account-already-staff'>
  | TaggedError<'app/requires-staff-account'>
  | TaggedError<'app/account-not-disabled'>
  | TaggedError<'app/not-delegable-to-customer'>
  | TaggedError<'app/cannot-orphan-account'>;
