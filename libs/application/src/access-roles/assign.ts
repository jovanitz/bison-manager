import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeMembershipId } from '@acme/domain';
import type { AccessActor, AccountId, RoleId } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import {
  guardGrantedPermissions,
  guardOwnerTarget,
  guardRootTarget,
} from '../access-admin/deps';
import {
  accountNotFound,
  cannotOrphanAccount,
  membershipNotFound,
} from '../access-admin/errors';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { RoleStore } from './ports';
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
 * Validate that every requested role exists, is reachable by the account, AND
 * that its permissions are legal INSIDE that account.
 *
 * The last part is the one that matters. A platform role carries `accountId:
 * null`, so the "not another org's role" test alone lets it through for ANY
 * account — and an org owner reaches `permissions.update` on their own account
 * by the ownership bypass (ADR-0011). Together that let a customer org owner
 * self-assign a seeded staff role (Support, and anything holding `any`-scoped
 * or staff-only actions) and inherit its authority. Assigning a role now obeys
 * exactly the same coherence law as granting its permissions directly or
 * inviting someone with them: inside a customer org, nothing `any`-scoped and
 * nothing outside the customer-delegable set.
 */
const guardAssignableRoles = async (
  deps: AssignMemberRolesDeps,
  accountId: AccountId,
  roleIds: ReadonlyArray<RoleId>,
): Promise<Result<void, RoleUseCaseError>> => {
  const roles = await deps.roles.findManyById(roleIds);
  if (roles.length !== roleIds.length) {
    return err(roleNotFound('One or more roles do not exist.'));
  }
  const foreign = roles.some(
    (role) => role.accountId !== null && role.accountId !== accountId,
  );
  if (foreign) {
    return err(roleNotFound('A role is not available to this account.'));
  }

  const account = await deps.admin.findAccount(accountId);
  if (!account) return err(accountNotFound(`No account ${accountId}.`));
  for (const role of roles) {
    const coherent = guardGrantedPermissions(role.permissions, account.kind);
    if (!coherent.ok) return err(coherent.error);
  }
  return ok(undefined);
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
