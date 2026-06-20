import { type Result, err, ok } from '@acme/shared';
import { makeAccessPermission } from '@acme/domain';
import type { AccessPermission, AccountId, RoleId } from '@acme/domain';
import type { RoleStore } from '../access-roles/ports';
import { invitationRoleInvalid } from './errors';
import type { AccessInvitationUseCaseError } from './errors';

/** Minimal linear-time shape check; real validation is the email roundtrip. */
export const looksLikeEmail = (email: string): boolean => {
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1 && !/\s/.test(email);
};

export const parseInvitationPermissions = (
  raw: ReadonlyArray<{ readonly action: string; readonly scope: string }>,
): Result<ReadonlyArray<AccessPermission>, AccessInvitationUseCaseError> => {
  const permissions: AccessPermission[] = [];
  for (const entry of raw) {
    const permission = makeAccessPermission(entry);
    if (!permission.ok) return err(permission.error);
    permissions.push(permission.value);
  }
  return ok(permissions);
};

/** Validate the invitation's roles exist AND are reachable by the account
 * (platform roles or the account's own) — the same rule as direct assignment. */
export const guardInvitationRoles = async (
  roles: Pick<RoleStore, 'findManyById'>,
  accountId: AccountId,
  rawRoleIds: ReadonlyArray<string>,
): Promise<Result<ReadonlyArray<RoleId>, AccessInvitationUseCaseError>> => {
  const roleIds = [...new Set(rawRoleIds)].map((id) => id as RoleId);
  if (roleIds.length === 0) return ok(roleIds);
  const found = await roles.findManyById(roleIds);
  if (found.length !== roleIds.length) {
    return err(invitationRoleInvalid('One or more roles do not exist.'));
  }
  const foreign = found.some(
    (role) => role.accountId !== null && role.accountId !== accountId,
  );
  if (foreign) {
    return err(
      invitationRoleInvalid('A role is not available to this account.'),
    );
  }
  return ok(roleIds);
};
