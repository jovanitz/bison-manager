import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeAccountId, makeMembershipId, makeUserId } from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { accessDenied } from '../access/errors';
import { authorizeAccessAction } from '../access/authorize';
import { guardRootTarget } from '../access-admin/deps';
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
      blocked
        ? {
            type: 'access.blocked',
            subjectKind: 'org',
            subjectId: accountId.value,
            actorMembershipId: input.actor.membership.id,
            reason: input.reason?.trim() || null,
            occurredAt: now,
          }
        : {
            type: 'access.unblocked',
            subjectKind: 'org',
            subjectId: accountId.value,
            actorMembershipId: input.actor.membership.id,
            occurredAt: now,
          },
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
      blocked
        ? {
            type: 'access.blocked',
            subjectKind: 'identity',
            subjectId: input.userId,
            actorMembershipId: input.actor.membership.id,
            reason: input.reason?.trim() || null,
            occurredAt: now,
          }
        : {
            type: 'access.unblocked',
            subjectKind: 'identity',
            subjectId: input.userId,
            actorMembershipId: input.actor.membership.id,
            occurredAt: now,
          },
    );
    return ok(undefined);
  };

/**
 * Block / unblock a single MEMBERSHIP — one user inside one org. This is the
 * org admin's own-scope tool (`members.block`): the target must live in the
 * actor's account, never the super-admin, and never your own membership (a
 * self-block would be an irreversible self-lockout). Idempotent.
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

    const rootGuard = guardRootTarget({
      targetIsRoot: membership.isRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);

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
      blocked
        ? {
            type: 'access.blocked',
            subjectKind: 'membership',
            subjectId: membership.id,
            actorMembershipId: input.actor.membership.id,
            reason: input.reason?.trim() || null,
            occurredAt: now,
          }
        : {
            type: 'access.unblocked',
            subjectKind: 'membership',
            subjectId: membership.id,
            actorMembershipId: input.actor.membership.id,
            occurredAt: now,
          },
    );
    return ok(undefined);
  };

export const makeBlockOrg = (deps: AccessBlockDeps) => setOrg(deps, true);
export const makeUnblockOrg = (deps: AccessBlockDeps) => setOrg(deps, false);
export const makeBlockIdentity = (deps: AccessBlockDeps) =>
  setIdentity(deps, true);
export const makeUnblockIdentity = (deps: AccessBlockDeps) =>
  setIdentity(deps, false);
export const makeBlockMember = (deps: AccessBlockDeps) =>
  setMembership(deps, true);
export const makeUnblockMember = (deps: AccessBlockDeps) =>
  setMembership(deps, false);

export type AccessBlockUseCases = {
  readonly blockOrg: ReturnType<typeof makeBlockOrg>;
  readonly unblockOrg: ReturnType<typeof makeUnblockOrg>;
  readonly blockIdentity: ReturnType<typeof makeBlockIdentity>;
  readonly unblockIdentity: ReturnType<typeof makeUnblockIdentity>;
  readonly blockMember: ReturnType<typeof makeBlockMember>;
  readonly unblockMember: ReturnType<typeof makeUnblockMember>;
};

export const makeAccessBlockUseCases = (
  deps: AccessBlockDeps,
): AccessBlockUseCases => ({
  blockOrg: makeBlockOrg(deps),
  unblockOrg: makeUnblockOrg(deps),
  blockIdentity: makeBlockIdentity(deps),
  unblockIdentity: makeUnblockIdentity(deps),
  blockMember: makeBlockMember(deps),
  unblockMember: makeUnblockMember(deps),
});
