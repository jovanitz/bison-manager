import { type Clock, type Result, err, ok } from '@acme/shared';
import {
  accessSessionExpiryFrom,
  makeAccountId,
  makeMembershipId,
} from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { guardOwnerTarget, guardRootTarget } from '../access-admin/deps';
import {
  accountNotFound,
  cannotOrphanAccount,
  membershipNotFound,
} from '../access-admin/errors';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { AccessSessionPolicyStore } from '../access-settings/ports';
import { cannotRemoveSelf } from './errors';
import type { AccessMembersUseCaseError } from './errors';
import type {
  AccessMemberDirectory,
  AccessMemberSnapshot,
  MyMembershipSnapshot,
} from './ports';

export type AccessMembersDeps = {
  readonly members: AccessMemberDirectory;
  readonly accounts: Pick<
    AccessAdminRepository,
    'findAccount' | 'findMembership'
  >;
  readonly sessionPolicies: Pick<
    AccessSessionPolicyStore,
    'loadSessionPolicies'
  >;
  readonly clock: Clock;
};

/** The members of one account — an org admin sees their own organization. */
export const makeListMembers =
  (deps: AccessMembersDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<
    Result<ReadonlyArray<AccessMemberSnapshot>, AccessMembersUseCaseError>
  > => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'members.read',
      resource: { accountId: accountId.value },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);

    const account = await deps.accounts.findAccount(accountId.value);
    if (!account) return err(accountNotFound(`No account ${input.accountId}.`));
    return ok(await deps.members.listMembers(account.id));
  };

/** Removes a member from their account; their sessions die atomically. */
export const makeRemoveMember =
  (deps: AccessMembersDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
  }): Promise<Result<void, AccessMembersUseCaseError>> => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);

    const membership = await deps.accounts.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    const rootGuard = guardRootTarget({
      targetIsRoot: membership.isRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);
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
      action: 'members.remove',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    if (membership.id === input.actor.membership.id) {
      return err(
        cannotRemoveSelf('Removing your own membership would lock you out.'),
      );
    }

    // Anti-orphan: removing the account's last administrator would leave it
    // ungovernable from within. We always ask; the adapter verifies atomically
    // (locked, EFFECTIVE count over roles — ADR-0014, so a role-granted admin
    // counts), refusing only a removal that drops the last admin, and the lock
    // serializes concurrent removals so they cannot race.
    const result = await deps.members.removeMember(
      membership.id,
      {
        type: 'member.removed',
        membershipId: membership.id,
        accountId: membership.accountId,
        actorMembershipId: input.actor.membership.id,
        occurredAt: now,
      },
      true,
    );
    if (result.orphaned) {
      return err(
        cannotOrphanAccount('An account must keep at least one administrator.'),
      );
    }
    return ok(undefined);
  };

/** Self-service: the caller's own organizations (no permission needed). */
export const makeListMyMemberships =
  (deps: AccessMembersDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<
    Result<ReadonlyArray<MyMembershipSnapshot>, AccessMembersUseCaseError>
  > =>
    ok(await deps.members.listMembershipsByUser(input.actor.membership.userId));

/**
 * Self-service organization switch: re-binds the CURRENT session to another
 * membership of the SAME user. Structural authorization — the target must be
 * yours; no permission can grant switching into someone else's membership.
 * Expiry is recomputed under the target account's policy (idle restarts now,
 * the absolute clock stays anchored at the original login); a switch into a
 * disabled account simply authorizes nothing (fail-closed policy).
 */
export const makeSwitchAccount =
  (deps: AccessMembersDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
  }): Promise<
    Result<{ readonly accountId: string }, AccessMembersUseCaseError>
  > => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);

    const mine = await deps.members.listMembershipsByUser(
      input.actor.membership.userId,
    );
    const target = mine.find((m) => m.membershipId === membershipId.value);
    if (!target) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }
    if (target.membershipId === input.actor.membership.id) {
      return ok({ accountId: target.accountId });
    }

    const now = deps.clock.now().toISOString();
    const policies = await deps.sessionPolicies.loadSessionPolicies();
    const expiresAt = accessSessionExpiryFrom(
      policies[target.accountKind],
      input.actor.session.createdAt,
      now,
    );
    await deps.members.switchSession(
      input.actor.session.id,
      target.membershipId,
      expiresAt,
      {
        type: 'session.switched',
        sessionId: input.actor.session.id,
        fromMembershipId: input.actor.membership.id,
        toMembershipId: target.membershipId,
        occurredAt: now,
      },
    );
    return ok({ accountId: target.accountId });
  };

export type AccessMembersUseCases = {
  readonly listMembers: ReturnType<typeof makeListMembers>;
  readonly removeMember: ReturnType<typeof makeRemoveMember>;
  readonly listMyMemberships: ReturnType<typeof makeListMyMemberships>;
  readonly switchAccount: ReturnType<typeof makeSwitchAccount>;
};

export const makeAccessMembersUseCases = (
  deps: AccessMembersDeps,
): AccessMembersUseCases => ({
  listMembers: makeListMembers(deps),
  removeMember: makeRemoveMember(deps),
  listMyMemberships: makeListMyMemberships(deps),
  switchAccount: makeSwitchAccount(deps),
});
