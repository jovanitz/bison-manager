import { defineError, type TaggedError } from '@acme/shared';
import type { AccessAdminUseCaseError } from '../access-admin/errors';

/** Removing your own membership would lock you out mid-request — sign out
 * or have another admin remove you instead. */
export const cannotRemoveSelf = defineError('app/cannot-remove-self');

export type AccessMembersUseCaseError =
  | AccessAdminUseCaseError
  | TaggedError<'app/cannot-remove-self'>;
