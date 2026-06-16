import { type Result, err, ok } from '@acme/shared';
import {
  accessSessionExpiryFrom,
  makeSessionId,
  makeUserId,
} from '@acme/domain';
import type { SessionId } from '@acme/domain';
import type { IdentityUseCaseError } from './errors';
import type { SessionContext } from './ports';
import { enforceSessionCap, resolveLoginMembership } from './provisioning';
import type { IdentityDeps } from './provisioning';

export type { IdentityDeps } from './provisioning';

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
  }): Promise<
    Result<{ readonly sessionId: SessionId | null }, IdentityUseCaseError>
  > => {
    const userId = makeUserId(input.userId);
    if (!userId.ok) return err(userId.error);
    const sessionId = makeSessionId(input.sessionId);
    if (!sessionId.ok) return err(sessionId.error);

    if (await deps.onboarding.sessionExists(sessionId.value)) {
      return ok({ sessionId: sessionId.value });
    }

    const occurredAt = deps.clock.now().toISOString();
    const membership = await resolveLoginMembership(
      deps,
      { userId: userId.value, email: input.email },
      occurredAt,
    );
    // Org-less identity: nothing to bind a session to. The actor path 401s; the
    // identity creates an organization via the identity-level endpoint instead.
    if (!membership) return ok({ sessionId: null });

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
    return ok({ sessionId: sessionId.value });
  };

export type IdentityUseCases = {
  readonly registerIdentitySession: ReturnType<
    typeof makeRegisterIdentitySession
  >;
};

export const makeIdentityUseCases = (deps: IdentityDeps): IdentityUseCases => ({
  registerIdentitySession: makeRegisterIdentitySession(deps),
});
