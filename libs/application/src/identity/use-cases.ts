import { type Result, err, ok } from '@acme/shared';
import {
  ACCESS_SESSION_MAX_CONCURRENT,
  accessSessionExpiryFrom,
  makeSessionId,
  makeUserId,
} from '@acme/domain';
import type { MembershipId, SessionId } from '@acme/domain';
import type { IdentityUseCaseError } from './errors';
import type { SessionContext } from './ports';
import { resolveLoginMembership } from './provisioning';
import type { IdentityDeps } from './provisioning';

export type { IdentityDeps } from './provisioning';

/**
 * Concurrent-session cap: when this login would exceed the limit, the
 * least-recently-seen sessions are revoked (audited as session.revoked, the
 * membership itself being the actor — their new login pushed the old out).
 */
export const enforceSessionCap = async (
  deps: IdentityDeps,
  membershipId: MembershipId,
  occurredAt: string,
): Promise<void> => {
  const active = await deps.onboarding.listActiveSessions(
    membershipId,
    occurredAt,
  );
  const excess = active.length - (ACCESS_SESSION_MAX_CONCURRENT - 1);
  if (excess <= 0) return;
  const oldest = [...active]
    .sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt))
    .slice(0, excess);
  for (const session of oldest) {
    await deps.sessions.revokeSession(session.sessionId, {
      type: 'session.revoked',
      sessionId: session.sessionId,
      actorMembershipId: membershipId,
      occurredAt,
    });
  }
};

export type RegisteredIdentitySession = {
  readonly sessionId: SessionId | null;
  /**
   * ADR-0016 D1 bounce, surfaced to the client: a pending invitation into
   * this org could not attach because the org is full. The login itself
   * still succeeded (existing membership, else org-less).
   */
  readonly seatBlockedAccountId?: string;
};

/**
 * Login bookkeeping, run when a verified identity presents a session our
 * authorization tables do not know yet. Idempotent per session id. Links the
 * user to a membership (provisioning one on first contact — owner bootstrap
 * or customer self-signup) and registers the session row + `login.succeeded`
 * atomically. After this, the session is revocable and authorizable like any
 * other — the JWT alone still authorizes nothing.
 */
export const makeRegisterIdentitySession =
  (deps: IdentityDeps) =>
  async (input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly email: string | null;
    readonly context: SessionContext;
  }): Promise<Result<RegisteredIdentitySession, IdentityUseCaseError>> => {
    const userId = makeUserId(input.userId);
    if (!userId.ok) return err(userId.error);
    const sessionId = makeSessionId(input.sessionId);
    if (!sessionId.ok) return err(sessionId.error);

    if (await deps.onboarding.sessionExists(sessionId.value)) {
      return ok({ sessionId: sessionId.value });
    }

    const occurredAt = deps.clock.now().toISOString();
    const resolved = await resolveLoginMembership(
      deps,
      { userId: userId.value, email: input.email },
      occurredAt,
    );
    const bounce =
      resolved.seatBlockedAccountId === null
        ? {}
        : { seatBlockedAccountId: resolved.seatBlockedAccountId };
    const membership = resolved.membership;
    // Org-less identity: nothing to bind a session to. The actor path 401s; the
    // identity creates an organization via the identity-level endpoint instead.
    if (!membership) return ok({ sessionId: null, ...bounce });

    // Initial expiry per the session policy of the account kind (dual clock:
    // both anchors are the login instant, so it resolves to now + idle TTL).
    const policies = await deps.sessionPolicies.loadSessionPolicies();
    const expiresAt = accessSessionExpiryFrom(
      policies[membership.accountKind],
      occurredAt,
      occurredAt,
    );
    await enforceSessionCap(deps, membership.membershipId, occurredAt);

    await deps.onboarding.createSession(
      {
        sessionId: sessionId.value,
        membershipId: membership.membershipId,
        createdAt: occurredAt,
        expiresAt,
        context: input.context,
      },
      {
        type: 'login.succeeded',
        userId: userId.value,
        sessionId: sessionId.value,
        occurredAt,
      },
    );
    return ok({ sessionId: sessionId.value, ...bounce });
  };

export type IdentityUseCases = {
  readonly registerIdentitySession: ReturnType<
    typeof makeRegisterIdentitySession
  >;
};

export const makeIdentityUseCases = (deps: IdentityDeps): IdentityUseCases => ({
  registerIdentitySession: makeRegisterIdentitySession(deps),
});
