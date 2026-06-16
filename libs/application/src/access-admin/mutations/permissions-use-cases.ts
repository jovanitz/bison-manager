import { type Result, err, ok } from '@acme/shared';
import { makeMembershipId } from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import {
  guardGrantedPermissions,
  guardRootTarget,
  holdsAdminCapability,
  parseGrantedPermissions,
} from '../deps';
import type { AccessAdminDeps } from '../deps';
import { cannotOrphanAccount, membershipNotFound } from '../errors';
import type { AccessAdminUseCaseError } from '../errors';

/** Replaces a membership's permission list — the persistent source of truth. */
export const makeUpdateUserPermissions =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }): Promise<Result<void, AccessAdminUseCaseError>> => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);
    const permissions = parseGrantedPermissions(input.permissions);
    if (!permissions.ok) return err(permissions.error);

    const membership = await deps.admin.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    // Super-admin protection: the root's permissions are off-limits to others.
    const rootGuard = guardRootTarget({
      targetIsRoot: membership.isRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'permissions.update',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const coherent = guardGrantedPermissions(
      permissions.value,
      membership.accountKind,
    );
    if (!coherent.ok) return err(coherent.error);

    // Anti-orphan: only a change that strips the governing capability needs
    // the account to retain another administrator — verified atomically by
    // the adapter (locked count), so concurrent demotions cannot both pass.
    const demotesAdmin =
      holdsAdminCapability(membership.permissions) &&
      !holdsAdminCapability(permissions.value);
    const result = await deps.admin.updatePermissions(
      membership.id,
      permissions.value,
      {
        type: 'permissions.updated',
        membershipId: membership.id,
        actorMembershipId: input.actor.membership.id,
        before: membership.permissions,
        after: permissions.value,
        occurredAt: now,
      },
      demotesAdmin,
    );
    if (result.orphaned) {
      return err(
        cannotOrphanAccount('An account must keep at least one administrator.'),
      );
    }
    return ok(undefined);
  };
