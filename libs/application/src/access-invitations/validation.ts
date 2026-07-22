import { type Result, err, ok } from '@acme/shared';
import { makeAccessPermission } from '@acme/domain';
import type {
  AccessPermission,
  AccountId,
  AccountKind,
  RoleId,
} from '@acme/domain';
import type { RoleStore } from '../access-roles/ports';
import { guardRolesForAccount } from '../access-roles/guards';
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

/**
 * Validate the invitation's roles through the ONE shared coherence law
 * (`guardRolesForAccount`): each role exists, is reachable by the account
 * (platform-wide or the account's own), AND — the part this path was missing —
 * carries only permissions the account's KIND may hold. Without the last check a
 * customer-org admin could attach a seeded platform role (Support) and smuggle
 * staff-grade `any`-scoped powers into a customer account. Same guard as direct
 * assignment, so the law cannot drift.
 */
export const guardInvitationRoles = async (
  roles: Pick<RoleStore, 'findManyById'>,
  accountId: AccountId,
  accountKind: AccountKind,
  rawRoleIds: ReadonlyArray<string>,
): Promise<Result<ReadonlyArray<RoleId>, AccessInvitationUseCaseError>> => {
  const roleIds = [...new Set(rawRoleIds)].map((id) => id as RoleId);
  const guarded = await guardRolesForAccount(
    roles,
    accountId,
    accountKind,
    roleIds,
  );
  if (guarded.ok) return ok(roleIds);
  return guarded.error.kind === 'incoherent'
    ? err(guarded.error.error)
    : err(invitationRoleInvalid('A role is not available to this account.'));
};
