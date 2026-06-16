import { defineError, type TaggedError } from '@acme/shared';
import type { AccessAdminUseCaseError } from '../access-admin/errors';

export const invitationAlreadyPending = defineError(
  'app/invitation-already-pending',
);
export const invalidInvitationEmail = defineError(
  'app/invalid-invitation-email',
);
/** Generic on purpose: a bad/expired/already-used token reveals nothing. */
export const invitationTokenInvalid = defineError(
  'app/invitation-token-invalid',
);
export const identityAlreadyExists = defineError('app/identity-already-exists');
export const identityProvisionFailed = defineError(
  'app/identity-provision-failed',
);

export type AccessInvitationUseCaseError =
  | AccessAdminUseCaseError
  | TaggedError<'app/invitation-already-pending'>
  | TaggedError<'app/invalid-invitation-email'>;

export type ActivateInvitationError =
  | TaggedError<'app/invitation-token-invalid'>
  | TaggedError<'app/identity-already-exists'>
  | TaggedError<'app/identity-provision-failed'>;
