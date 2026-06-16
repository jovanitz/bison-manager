import type { Clock, IdGenerator } from '@acme/shared';
import {
  ACCESS_SESSION_MAX_CONCURRENT,
  accessPresetPermissions,
} from '@acme/domain';
import type {
  AccountId,
  AccountKind,
  MembershipId,
  UserId,
} from '@acme/domain';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { AccessInvitationStore } from '../access-invitations/ports';
import type { AccessMemberDirectory } from '../access-members/ports';
import type { AccessSessionPolicyStore } from '../access-settings/ports';
import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
} from './ports';

export type IdentityDeps = {
  readonly onboarding: IdentityOnboardingRepository;
  readonly sessionPolicies: Pick<
    AccessSessionPolicyStore,
    'loadSessionPolicies'
  >;
  /** Used by the concurrent-session cap to push out the oldest session. */
  readonly sessions: Pick<AccessAdminRepository, 'revokeSession'>;
  /** Login-time check: a pending invitation beats every other path. */
  readonly invitations: Pick<AccessInvitationStore, 'findPendingByEmail'>;
  /** Multi-organization: a user may hold one membership per account. */
  readonly members: Pick<AccessMemberDirectory, 'listMembershipsByUser'>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /**
   * The documented owner-bootstrap mechanism (ADR-0010): read from env in the
   * API composition root only. When no root admin exists and this email signs
   * in, that identity is promoted exactly once. Null disables bootstrapping.
   */
  readonly bootstrapOwnerEmail: string | null;
};

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

/** Invitation flow: the invited email joins the inviting account. */
const acceptPendingInvitation = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string },
  occurredAt: string,
): Promise<{
  readonly membershipId: MembershipId;
  readonly accountKind: AccountKind;
} | null> => {
  const pending = await deps.invitations.findPendingByEmail(
    identity.email,
    occurredAt,
  );
  if (!pending) return null;
  const membershipId = deps.ids.next() as MembershipId;
  await deps.onboarding.acceptInvitation(
    {
      membershipId,
      accountId: pending.accountId,
      userId: identity.userId,
      email: identity.email,
      displayName: identity.email,
      permissions: pending.permissions,
      occurredAt,
    },
    pending.invitationId,
    {
      type: 'invitation.accepted',
      invitationId: pending.invitationId,
      accountId: pending.accountId,
      membershipId,
      userId: identity.userId,
      occurredAt,
    },
  );
  return { membershipId, accountKind: pending.accountKind };
};

/**
 * Which membership does this login act as? Decided in priority order:
 * 1. A pending invitation for the email joins the inviting account NOW (also
 *    for users who already have other memberships — multi-organization) and
 *    binds the session there: the invitation is the freshest intent. If the
 *    user already belongs to that account, the invitation is simply ignored.
 * 2. An existing membership (the user's first; switchable per session).
 * 3. First contact: owner bootstrap, else ORG-LESS (null) — the identity must
 *    create its own organization or be invited into one.
 */
export const resolveLoginMembership = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string | null },
  occurredAt: string,
): Promise<{
  readonly membershipId: MembershipId;
  readonly accountKind: AccountKind;
} | null> => {
  const mine = await deps.members.listMembershipsByUser(identity.userId);
  const pending =
    identity.email === null
      ? null
      : await deps.invitations.findPendingByEmail(identity.email, occurredAt);
  if (pending) {
    const already = mine.find((m) => m.accountId === pending.accountId);
    if (already) {
      return {
        membershipId: already.membershipId,
        accountKind: already.accountKind,
      };
    }
    const invited = await acceptPendingInvitation(
      deps,
      { userId: identity.userId, email: identity.email ?? '' },
      occurredAt,
    );
    if (invited) return invited;
  }
  const existing = mine[0];
  if (existing) {
    return {
      membershipId: existing.membershipId,
      accountKind: existing.accountKind,
    };
  }
  return provisionMembership(deps, identity, occurredAt);
};

/**
 * First contact. The ONLY automatic membership is the env-driven owner
 * bootstrap; every other new identity is left ORG-LESS (returns null) — they
 * explicitly create their own organization, or are invited into one. No
 * silent customer org is minted.
 */
export const provisionMembership = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string | null },
  occurredAt: string,
): Promise<{
  readonly membershipId: MembershipId;
  readonly accountKind: AccountKind;
} | null> => {
  const bootstrap =
    deps.bootstrapOwnerEmail !== null &&
    identity.email !== null &&
    sameEmail(identity.email, deps.bootstrapOwnerEmail) &&
    !(await deps.onboarding.rootAdminExists());

  if (!bootstrap) return null;

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
  return { membershipId: membership.membershipId, accountKind: 'staff' };
};
