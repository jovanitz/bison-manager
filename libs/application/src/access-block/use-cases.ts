import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeAccountId, makeMembershipId, makeUserId } from '@acme/domain';
import type {
  AccessActor,
  AccessBlocked,
  AccessBlockSubjectKind,
  AccessUnblocked,
} from '@acme/domain';
import { accessDenied } from '../access/errors';
import { authorizeAccessAction } from '../access/authorize';
import { guardMembershipTarget, guardRootTarget } from '../access-admin/deps';
import { accountNotFound, membershipNotFound } from '../access-admin/errors';
import type { AccessAdminUseCaseError } from '../access-admin/errors';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { AccessBlockStore } from './ports';

export type AccessBlockDeps = {
  readonly blocks: AccessBlockStore;
  readonly accounts: Pick<
    AccessAdminRepository,
    'findAccount' | 'findMembership'
  >;
  readonly clock: Clock;
};

type BlockResult = Promise<Result<void, AccessAdminUseCaseError>>;

/** Build the block / unblock audit event for any subject kind (shared shape). */
const blockEvent = (input: {
  readonly subjectKind: AccessBlockSubjectKind;
  readonly subjectId: string;
  readonly actor: AccessActor;
  readonly blocked: boolean;
  readonly reason: string | undefined;
  readonly occurredAt: string;
}): AccessBlocked | AccessUnblocked => {
  const base = {
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    actorMembershipId: input.actor.membership.id,
    occurredAt: input.occurredAt,
  };
  return input.blocked
    ? { ...base, type: 'access.blocked', reason: input.reason?.trim() || null }
    : { ...base, type: 'access.unblocked' };
};

/**
 * Block / unblock a whole ORG (account): all its members keep authenticating
 * but cannot operate. Authorized by `access.block`, protected against the
 * super-admin's account, idempotent (no duplicate audit on a no-op).
 */
const setOrg =
  (deps: AccessBlockDeps, blocked: boolean) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly reason?: string;
  }): BlockResult => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'access.block',
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const account = await deps.accounts.findAccount(accountId.value);
    if (!account) return err(accountNotFound(`No account ${input.accountId}.`));

    const rootGuard = guardRootTarget({
      targetIsRoot: account.hostsRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);

    if ((await deps.blocks.isOrgBlocked(accountId.value)) === blocked) {
      return ok(undefined); // already in the desired state — no-op, no event
    }
    await deps.blocks.setOrgBlocked(
      accountId.value,
      blocked,
      blockEvent({
        subjectKind: 'org',
        subjectId: accountId.value,
        actor: input.actor,
        blocked,
        reason: input.reason,
        occurredAt: now,
      }),
    );
    return ok(undefined);
  };

/**
 * Block / unblock an IDENTITY (user) across every org. Same `access.block`
 * permission, refused for the super-admin's identity, idempotent.
 */
const setIdentity =
  (deps: AccessBlockDeps, blocked: boolean) =>
  async (input: {
    readonly actor: AccessActor;
    readonly userId: string;
    readonly reason?: string;
  }): BlockResult => {
    const userId = makeUserId(input.userId);
    if (!userId.ok) return err(userId.error);
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'access.block',
      resource: { accountId: null },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const rootGuard = guardRootTarget({
      targetIsRoot: await deps.blocks.isIdentityRoot(input.userId),
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);

    if ((await deps.blocks.isIdentityBlocked(input.userId)) === blocked) {
      return ok(undefined);
    }
    await deps.blocks.setIdentityBlocked(
      input.userId,
      blocked,
      blockEvent({
        subjectKind: 'identity',
        subjectId: input.userId,
        actor: input.actor,
        blocked,
        reason: input.reason,
        occurredAt: now,
      }),
    );
    return ok(undefined);
  };

/**
 * Block / unblock a single MEMBERSHIP — the org admin's own-scope tool
 * (`members.block`): never the super-admin/owner, never your own membership
 * (self-lockout). Idempotent.
 */
const setMembership =
  (deps: AccessBlockDeps, blocked: boolean) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
    readonly reason?: string;
  }): BlockResult => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);
    const now = deps.clock.now().toISOString();

    const membership = await deps.accounts.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    const guard = guardMembershipTarget({
      target: {
        isRoot: membership.isRoot,
        isAccountOwner: membership.isAccountOwner,
        accountId: membership.accountId,
        membershipId: membership.id,
      },
      actor: input.actor,
    });
    if (!guard.ok) return err(guard.error);
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'members.block',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    if (membership.id === input.actor.membership.id) {
      return err(accessDenied('You cannot block your own membership.'));
    }

    if ((await deps.blocks.isMembershipBlocked(membership.id)) === blocked) {
      return ok(undefined);
    }
    await deps.blocks.setMembershipBlocked(
      membership.id,
      blocked,
      blockEvent({
        subjectKind: 'membership',
        subjectId: membership.id,
        actor: input.actor,
        blocked,
        reason: input.reason,
        occurredAt: now,
      }),
    );
    return ok(undefined);
  };

export type AccessBlockUseCases = {
  readonly blockOrg: ReturnType<typeof setOrg>;
  readonly unblockOrg: ReturnType<typeof setOrg>;
  readonly blockIdentity: ReturnType<typeof setIdentity>;
  readonly unblockIdentity: ReturnType<typeof setIdentity>;
  readonly blockMember: ReturnType<typeof setMembership>;
  readonly unblockMember: ReturnType<typeof setMembership>;
};

export const makeAccessBlockUseCases = (
  deps: AccessBlockDeps,
): AccessBlockUseCases => ({
  blockOrg: setOrg(deps, true),
  unblockOrg: setOrg(deps, false),
  blockIdentity: setIdentity(deps, true),
  unblockIdentity: setIdentity(deps, false),
  blockMember: setMembership(deps, true),
  unblockMember: setMembership(deps, false),
});
