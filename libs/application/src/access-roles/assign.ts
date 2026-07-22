import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeMembershipId } from '@acme/domain';
import type { AccessActor, AccountId, RoleId } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { guardOwnerTarget, guardRootTarget } from '../access-admin/deps';
import {
  accountNotFound,
  cannotOrphanAccount,
  membershipNotFound,
} from '../access-admin/errors';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { RoleStore } from './ports';
import { guardRolesForAccount } from './guards';
import { roleNotFound, type RoleUseCaseError } from './errors';

export type AssignMemberRolesDeps = {
  readonly roles: RoleStore;
  readonly admin: AccessAdminRepository;
  readonly clock: Clock;
};

// Assigning roles is "deciding who-can-do-what" — gated by the same action as
// editing permissions; root/owner reach it by bypass (ADR-0011).
const ROLE_ACTION = 'permissions.update' as const;

/**
 * Validate a role assignment through the ONE shared coherence law
 * (`guardRolesForAccount`): every role exists, is reachable by the account, AND
 * carries only permissions its kind may hold. That last part is what stops a
 * customer org owner (who reaches `permissions.update` on their own account via
 * the ownership bypass, ADR-0011) from self-assigning a seeded staff role
 * (Support / anything `any`-scoped) and inheriting its authority. Invitation and
 * direct assignment share the same guard so the law cannot drift between them.
 */
const guardAssignableRoles = async (
  deps: AssignMemberRolesDeps,
  accountId: AccountId,
  roleIds: ReadonlyArray<RoleId>,
): Promise<Result<void, RoleUseCaseError>> => {
  const account = await deps.admin.findAccount(accountId);
  if (!account) return err(accountNotFound(`No account ${accountId}.`));
  const guarded = await guardRolesForAccount(
    deps.roles,
    accountId,
    account.kind,
    roleIds,
  );
  if (guarded.ok) return ok(undefined);
  return guarded.error.kind === 'incoherent'
    ? err(guarded.error.error)
    : err(roleNotFound('A role is not available to this account.'));
};

/** Replace a membership's role assignment (ADR-0011, roles-only). */
export const makeAssignMemberRoles =
  (deps: AssignMemberRolesDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
    readonly roleIds: ReadonlyArray<string>;
  }): Promise<Result<void, RoleUseCaseError>> => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);
    const membership = await deps.admin.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }
    // The super-admin's authority is not editable by others.
    const rootGuard = guardRootTarget({
      targetIsRoot: membership.isRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);
    // Owner protection: a same-account non-owner peer cannot reassign the
    // account owner's roles.
    const ownerGuard = guardOwnerTarget({
      target: {
        isAccountOwner: membership.isAccountOwner,
        accountId: membership.accountId,
        membershipId: membership.id,
      },
      actor: input.actor,
    });
    if (!ownerGuard.ok) return err(ownerGuard.error);

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: ROLE_ACTION,
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const roleIds = [...new Set(input.roleIds)].map((id) => id as RoleId);
    const assignable = await guardAssignableRoles(
      deps,
      membership.accountId,
      roleIds,
    );
    if (!assignable.ok) return assignable;

    const result = await deps.admin.assignRoles(membership.id, roleIds, {
      type: 'member.roles-assigned',
      membershipId: membership.id,
      actorMembershipId: input.actor.membership.id,
      roleIds,
      occurredAt: now,
    });
    if (result.orphaned) {
      return err(
        cannotOrphanAccount('An account must keep at least one administrator.'),
      );
    }
    return ok(undefined);
  };
