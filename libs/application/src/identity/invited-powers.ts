import type { AccessPermission, RoleId } from '@acme/domain';
import { guardGrantedPermissions } from '../access-admin/deps';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { PendingAccessInvitation } from '../access-invitations/ports';
import { guardRolesForAccount } from '../access-roles/guards';
import type { RoleStore } from '../access-roles/ports';

export type InvitedPowersDeps = {
  readonly accounts: Pick<AccessAdminRepository, 'findAccount'>;
  readonly roles: Pick<RoleStore, 'findManyById'>;
};

/**
 * Re-validate an invitation's STORED powers against the account's CURRENT kind
 * (ADR-0011) at attach time. An invitation records the roles/permissions and the
 * kind at CREATION, but the account may have been demoted staff→customer since —
 * so a stored staff-grade set would otherwise smuggle `any`-scoped powers into a
 * now-customer account on first login (the audit's onboarding residual). If
 * either the direct permissions or any attached role is no longer coherent, DROP
 * the granted powers and attach a bare membership: the user still joins, staff
 * re-grant appropriately. Same shared guard as invitation-creation and direct
 * assignment, so the coherence law holds at EVERY attach point.
 */
export const coherentInvitedPowers = async (
  deps: InvitedPowersDeps,
  pending: PendingAccessInvitation,
): Promise<{
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly roleIds: ReadonlyArray<RoleId>;
}> => {
  const account = await deps.accounts.findAccount(pending.accountId);
  const kind = account?.kind ?? pending.accountKind;
  const permsOk = guardGrantedPermissions(pending.permissions, kind).ok;
  const rolesOk = (
    await guardRolesForAccount(
      deps.roles,
      pending.accountId,
      kind,
      pending.roleIds,
    )
  ).ok;
  return permsOk && rolesOk
    ? { permissions: pending.permissions, roleIds: pending.roleIds }
    : { permissions: [], roleIds: [] };
};
