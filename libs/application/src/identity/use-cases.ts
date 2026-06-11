import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import {
  accessPresetPermissions,
  makeSessionId,
  makeUserId,
} from '@acme/domain';
import type { AccountId, MembershipId, SessionId, UserId } from '@acme/domain';
import type { IdentityUseCaseError } from './errors';
import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
} from './ports';

export type IdentityDeps = {
  readonly onboarding: IdentityOnboardingRepository;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /**
   * The documented owner-bootstrap mechanism (ADR-0010): read from env in the
   * API composition root only. When no root admin exists and this email signs
   * in, that identity is promoted exactly once. Null disables bootstrapping.
   */
  readonly bootstrapOwnerEmail: string | null;
};

const sameEmail = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const buildMembership = (input: {
  readonly deps: IdentityDeps;
  readonly userId: UserId;
  readonly email: string | null;
  readonly displayName: string;
  readonly preset: 'owner' | 'customer';
  readonly occurredAt: string;
}): NewIdentityMembership => ({
  membershipId: input.deps.ids.next() as MembershipId,
  accountId: input.deps.ids.next() as AccountId,
  userId: input.userId,
  email: input.email,
  displayName: input.displayName,
  permissions: accessPresetPermissions(input.preset),
  occurredAt: input.occurredAt,
});

const provisionMembership = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string | null },
  occurredAt: string,
): Promise<MembershipId> => {
  const bootstrap =
    deps.bootstrapOwnerEmail !== null &&
    identity.email !== null &&
    sameEmail(identity.email, deps.bootstrapOwnerEmail) &&
    !(await deps.onboarding.rootAdminExists());

  if (bootstrap) {
    const membership = buildMembership({
      deps,
      userId: identity.userId,
      email: identity.email,
      displayName: 'Owner',
      preset: 'owner',
      occurredAt,
    });
    await deps.onboarding.createOwnerMembership(membership, {
      type: 'owner.bootstrapped',
      membershipId: membership.membershipId,
      userId: identity.userId,
      occurredAt,
    });
    return membership.membershipId;
  }

  const membership = buildMembership({
    deps,
    userId: identity.userId,
    email: identity.email,
    displayName: identity.email ?? 'Customer',
    preset: 'customer',
    occurredAt,
  });
  await deps.onboarding.createCustomerMembership(membership);
  return membership.membershipId;
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
    readonly sessionExpiresAt: string;
  }): Promise<
    Result<{ readonly sessionId: SessionId }, IdentityUseCaseError>
  > => {
    const userId = makeUserId(input.userId);
    if (!userId.ok) return err(userId.error);
    const sessionId = makeSessionId(input.sessionId);
    if (!sessionId.ok) return err(sessionId.error);

    if (await deps.onboarding.sessionExists(sessionId.value)) {
      return ok({ sessionId: sessionId.value });
    }

    const occurredAt = deps.clock.now().toISOString();
    const existing = await deps.onboarding.findMembershipByUser(userId.value);
    const membershipId =
      existing?.membershipId ??
      (await provisionMembership(
        deps,
        { userId: userId.value, email: input.email },
        occurredAt,
      ));

    await deps.onboarding.createSession(
      {
        sessionId: sessionId.value,
        membershipId,
        expiresAt: input.sessionExpiresAt,
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
