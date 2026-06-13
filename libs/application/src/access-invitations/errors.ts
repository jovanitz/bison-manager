import { defineError, type TaggedError } from '@acme/shared';
import type { AccessAdminUseCaseError } from '../access-admin/errors';

export const invitationAlreadyPending = defineError(
  'app/invitation-already-pending',
);
export const invalidInvitationEmail = defineError(
  'app/invalid-invitation-email',
);

export type AccessInvitationUseCaseError =
  | AccessAdminUseCaseError
  | TaggedError<'app/invitation-already-pending'>
  | TaggedError<'app/invalid-invitation-email'>;
