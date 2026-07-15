import { defineError, type TaggedError } from '@acme/shared';
import type { AccessAdminUseCaseError } from '../access-admin/errors';

export const invitationAlreadyPending = defineError(
  'app/invitation-already-pending',
);
export const invalidInvitationEmail = defineError(
  'app/invalid-invitation-email',
);
/** A role on the invitation does not exist or is not reachable by the account. */
export const invitationRoleInvalid = defineError('app/invitation-role-invalid');
/** Generic on purpose: a bad/expired/already-used token reveals nothing. */
export const invitationTokenInvalid = defineError(
  'app/invitation-token-invalid',
);
export const identityAlreadyExists = defineError('app/identity-already-exists');
export const identityProvisionFailed = defineError(
  'app/identity-provision-failed',
);
/**
 * No PENDING invitation with that id — unknown, already accepted, already
 * revoked, or expired. Staff-facing (they are looking at a list they own), so
 * unlike `invitation-token-invalid` there is nothing to hide here. `-not-found`
 * maps to 404 at the API boundary.
 */
export const invitationNotFound = defineError('app/invitation-not-found');

export type AccessInvitationUseCaseError =
  | AccessAdminUseCaseError
  | TaggedError<'app/invitation-already-pending'>
  | TaggedError<'app/invalid-invitation-email'>
  | TaggedError<'app/invitation-role-invalid'>;

export type ActivateInvitationError =
  | TaggedError<'app/invitation-token-invalid'>
  | TaggedError<'app/identity-already-exists'>
  | TaggedError<'app/identity-provision-failed'>;
