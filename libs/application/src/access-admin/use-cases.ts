import { type Clock, type Result, err, ok } from '@acme/shared';
import {
  makeAccessPermission,
  makeAccountId,
  makeMembershipId,
  makeSessionId,
} from '@acme/domain';
import type { AccessActor, AccessPermission } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import {
  accountAlreadyDisabled,
  accountNotFound,
  membershipNotFound,
  sessionAlreadyRevoked,
  sessionNotFound,
} from './errors';
import type { AccessAdminUseCaseError } from './errors';
import type { AccessAdminRepository } from './ports';

export type AccessAdminDeps = {
  readonly admin: AccessAdminRepository;
  readonly clock: Clock;
};

type AdminResult = Promise<Result<void, AccessAdminUseCaseError>>;

export const makeDisableAccount =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly reason?: string;
  }): AdminResult => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'account.disable',
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const account = await deps.admin.findAccount(accountId.value);
    if (!account) return err(accountNotFound(`No account ${input.accountId}.`));
    if (account.status === 'disabled') {
      return err(
        accountAlreadyDisabled(`Account ${input.accountId} is disabled.`),
      );
    }

    await deps.admin.disableAccount(account.id, {
      type: 'account.disabled',
      accountId: account.id,
      actorMembershipId: input.actor.membership.id,
      reason: input.reason?.trim() || null,
      occurredAt: now,
    });
    return ok(undefined);
  };

const parsePermissions = (
  raw: ReadonlyArray<{ readonly action: string; readonly scope: string }>,
): Result<ReadonlyArray<AccessPermission>, AccessAdminUseCaseError> => {
  const permissions: AccessPermission[] = [];
  for (const entry of raw) {
    const permission = makeAccessPermission(entry);
    if (!permission.ok) return err(permission.error);
    permissions.push(permission.value);
  }
  return ok(permissions);
};

export const makeUpdateUserPermissions =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }): AdminResult => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);
    const permissions = parsePermissions(input.permissions);
    if (!permissions.ok) return err(permissions.error);

    const membership = await deps.admin.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'permissions.update',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    await deps.admin.updatePermissions(membership.id, permissions.value, {
      type: 'permissions.updated',
      membershipId: membership.id,
      actorMembershipId: input.actor.membership.id,
      before: membership.permissions,
      after: permissions.value,
      occurredAt: now,
    });
    return ok(undefined);
  };

export const makeRevokeSession =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly sessionId: string;
  }): AdminResult => {
    const sessionId = makeSessionId(input.sessionId);
    if (!sessionId.ok) return err(sessionId.error);

    const session = await deps.admin.findSession(sessionId.value);
    if (!session) return err(sessionNotFound(`No session ${input.sessionId}.`));

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'sessions.revoke',
      resource: { accountId: session.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    if (session.status === 'revoked') {
      return err(
        sessionAlreadyRevoked(`Session ${input.sessionId} is revoked.`),
      );
    }

    await deps.admin.revokeSession(session.id, {
      type: 'session.revoked',
      sessionId: session.id,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    return ok(undefined);
  };

export type AccessAdminUseCases = {
  readonly disableAccount: ReturnType<typeof makeDisableAccount>;
  readonly updateUserPermissions: ReturnType<typeof makeUpdateUserPermissions>;
  readonly revokeSession: ReturnType<typeof makeRevokeSession>;
};

export const makeAccessAdminUseCases = (
  deps: AccessAdminDeps,
): AccessAdminUseCases => ({
  disableAccount: makeDisableAccount(deps),
  updateUserPermissions: makeUpdateUserPermissions(deps),
  revokeSession: makeRevokeSession(deps),
});
