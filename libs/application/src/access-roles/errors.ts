import { defineError, type TaggedError } from '@acme/shared';
import type { AccessDomainError } from '@acme/domain';
import type { AccessUseCaseError } from '../access/errors';
import type { AccessAdminUseCaseError } from '../access-admin/errors';

/** A role cannot be deleted while memberships still reference it (ADR-0011). */
export const roleInUse = defineError('app/role-in-use');
/** The targeted role does not exist. */
export const roleNotFound = defineError('app/role-not-found');

export type RoleUseCaseError =
  | AccessUseCaseError
  | AccessAdminUseCaseError
  | AccessDomainError
  | TaggedError<'app/role-in-use' | 'app/role-not-found'>;
