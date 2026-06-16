import { type Result, err, ok } from '@acme/shared';
import { makeMembershipId, makeSessionId } from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import {
  membershipNotFound,
  sessionAlreadyRevoked,
  sessionNotFound,
} from '../errors';
import type { AccessAdminUseCaseError } from '../errors';
import { guardRootTarget } from '../deps';
import type { AccessAdminDeps } from '../deps';
import type { AdminSessionDetail } from '../ports';

type AdminResult = Promise<Result<void, AccessAdminUseCaseError>>;

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

    const rootGuard = guardRootTarget({
      targetIsRoot: session.isRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);

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

/** "Log out everywhere" for one membership (own account or any, per scope). */
export const makeRevokeAllSessions =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
  }): Promise<
    Result<{ readonly revoked: number }, AccessAdminUseCaseError>
  > => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);

    const membership = await deps.admin.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    const rootGuard = guardRootTarget({
      targetIsRoot: membership.isRoot,
      actor: input.actor,
    });
    if (!rootGuard.ok) return err(rootGuard.error);

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'sessions.revoke',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const revoked = await deps.admin.revokeAllSessions(membership.id, {
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    return ok({ revoked });
  };

/** The "active sessions" view of a membership (own account or any, per scope). */
export const makeListSessions =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
  }): Promise<
    Result<ReadonlyArray<AdminSessionDetail>, AccessAdminUseCaseError>
  > => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);

    const membership = await deps.admin.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'sessions.read',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    return ok(await deps.admin.listSessions(membership.id));
  };
