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
export const accountAlreadyCustomer = defineError(
  'app/account-already-customer',
);
/** The root's account may never be demoted (super-admin protection). */
export const cannotDemoteRoot = defineError('app/cannot-demote-root');
export const deletionAlreadyScheduled = defineError(
  'app/deletion-already-scheduled',
);
export const deletionNotScheduled = defineError('app/deletion-not-scheduled');
/** The root's account may never be scheduled for deletion. */
export const cannotDeleteRoot = defineError('app/cannot-delete-root');
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
  | TaggedError<'app/account-already-customer'>
  | TaggedError<'app/cannot-demote-root'>
  | TaggedError<'app/deletion-already-scheduled'>
  | TaggedError<'app/deletion-not-scheduled'>
  | TaggedError<'app/cannot-delete-root'>
  | TaggedError<'app/requires-staff-account'>
  | TaggedError<'app/account-not-disabled'>
  | TaggedError<'app/not-delegable-to-customer'>
  | TaggedError<'app/cannot-orphan-account'>;
