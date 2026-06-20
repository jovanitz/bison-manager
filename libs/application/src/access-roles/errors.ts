import { defineError, type TaggedError } from '@acme/shared';
import type { AccessDomainError } from '@acme/domain';
import type { AccessUseCaseError } from '../access/errors';
import type { AccessAdminUseCaseError } from '../access-admin/errors';

/** A role cannot be deleted while memberships still reference it (ADR-0011). */
export const roleInUse = defineError('app/role-in-use');
/** The targeted role does not exist. */
export const roleNotFound = defineError('app/role-not-found');
/** A default (template-derived) role cannot be deleted — reset it (ADR-0012). */
export const roleIsDefault = defineError('app/role-is-default');
/** The role has no factory template to reset to (custom or stale key). */
export const roleNotResettable = defineError('app/role-not-resettable');

export type RoleUseCaseError =
  | AccessUseCaseError
  | AccessAdminUseCaseError
  | AccessDomainError
  | TaggedError<
      | 'app/role-in-use'
      | 'app/role-not-found'
      | 'app/role-is-default'
      | 'app/role-not-resettable'
    >;
