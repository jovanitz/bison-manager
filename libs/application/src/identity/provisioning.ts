import type { Clock, IdGenerator } from '@acme/shared';
import { accessPresetPermissions } from '@acme/domain';
import type {
  AccountId,
  AccountKind,
  MembershipId,
  UserId,
} from '@acme/domain';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { AccessInvitationStore } from '../access-invitations/ports';
import type { PendingAccessInvitation } from '../access-invitations/ports';
import type { AccessMemberDirectory } from '../access-members/ports';
import type { AccessSessionPolicyStore } from '../access-settings/ports';
import type { EntitlementGuards } from '../billing-subscriptions/guards';
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
  readonly invitations: Pick<
    AccessInvitationStore,
    'findPendingByEmail' | 'markSeatBlocked'
  >;
  /** Multi-organization: a user may hold one membership per account. */
  readonly members: Pick<AccessMemberDirectory, 'listMembershipsByUser'>;
  /** ADR-0016 D1: the resolved seat ceiling for the attach-time check. */
  readonly billing: {
    readonly seatLimitFor: EntitlementGuards['seatLimitFor'];
  };
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

type LoginMembership = {
  readonly membershipId: MembershipId;
  readonly accountKind: AccountKind;
};

/** How a login resolved; the bounce (ADR-0016 D1) travels beside it. */
export type LoginMembershipResolution = {
  readonly membership: LoginMembership | null;
  /** The invited org that was FULL at attach time (invitation left pending). */
  readonly seatBlockedAccountId: string | null;
};

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

/**
 * Invitation flow: the invited email joins the inviting account — unless the
 * org is FULL, decided transactionally by the adapter against the resolved
 * seat ceiling (invitations never reserve seats; staff orgs are unlimited).
 */
const acceptPendingInvitation = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string },
  pending: PendingAccessInvitation,
  occurredAt: string,
): Promise<LoginMembership | 'seat-blocked'> => {
  const seatLimit = await deps.billing.seatLimitFor({
    accountId: pending.accountId,
    kind: pending.accountKind,
  });
  const membershipId = deps.ids.next() as MembershipId;
  const outcome = await deps.onboarding.acceptInvitation(
    {
      membershipId,
      accountId: pending.accountId,
      userId: identity.userId,
      email: identity.email,
      displayName: identity.email,
      permissions: pending.permissions,
      roleIds: pending.roleIds,
      occurredAt,
    },
    { invitationId: pending.invitationId, seatLimit },
    {
      type: 'invitation.accepted',
      invitationId: pending.invitationId,
      accountId: pending.accountId,
      membershipId,
      userId: identity.userId,
      occurredAt,
    },
  );
  if (outcome === 'seat-blocked') return 'seat-blocked';
  return { membershipId, accountKind: pending.accountKind };
};

/**
 * Which membership does this login act as? Decided in priority order:
 * 1. A pending invitation for the email joins the inviting account NOW (also
 *    for users who already have other memberships — multi-organization) and
 *    binds the session there: the invitation is the freshest intent. If the
 *    user already belongs to that account, the invitation is simply ignored.
 *    The attach can BOUNCE at the seat limit (ADR-0016 D1): the invitation is
 *    marked seat-blocked, the login proceeds without it, and — the explicit
 *    contract — a marked invitation never silently auto-attaches later once
 *    the user holds any membership; only a still org-less user retries it.
 * 2. An existing membership (the user's first; switchable per session).
 * 3. First contact: owner bootstrap, else ORG-LESS (null) — the identity must
 *    create its own organization or be invited into one.
 */
export const resolveLoginMembership = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string | null },
  occurredAt: string,
): Promise<LoginMembershipResolution> => {
  const mine = await deps.members.listMembershipsByUser(identity.userId);
  const fallback = async (): Promise<LoginMembership | null> => {
    const existing = mine[0];
    if (existing) {
      return {
        membershipId: existing.membershipId,
        accountKind: existing.accountKind,
      };
    }
    return provisionMembership(deps, identity, occurredAt);
  };
  const pending =
    identity.email === null
      ? null
      : await deps.invitations.findPendingByEmail(identity.email, occurredAt);
  const alreadyIn =
    pending && mine.find((m) => m.accountId === pending.accountId);
  if (alreadyIn) {
    return {
      membership: {
        membershipId: alreadyIn.membershipId,
        accountKind: alreadyIn.accountKind,
      },
      seatBlockedAccountId: null,
    };
  }
  const skipBounced =
    pending !== null && pending.seatBlockedAt !== null && mine.length > 0;
  if (!pending || skipBounced) {
    return { membership: await fallback(), seatBlockedAccountId: null };
  }
  const invited = await acceptPendingInvitation(
    deps,
    { userId: identity.userId, email: identity.email ?? '' },
    pending,
    occurredAt,
  );
  if (invited !== 'seat-blocked') {
    return { membership: invited, seatBlockedAccountId: null };
  }
  // The bounce: mark it for the inviting admin, attach nothing from it — the
  // login itself still succeeds (existing membership, else org-less).
  await deps.invitations.markSeatBlocked(pending.invitationId, occurredAt);
  return {
    membership: await fallback(),
    seatBlockedAccountId: pending.accountId,
  };
};

/**
 * First contact. The ONLY automatic membership is the env-driven owner
 * bootstrap; every other new identity is left ORG-LESS (returns null) — they
 * explicitly create their own organization, or are invited into one. No
 * silent customer org is minted. Deliberately subscription-free: the staff
 * org never has one (billing never gates staff, ADR-0016).
 */
export const provisionMembership = async (
  deps: IdentityDeps,
  identity: { readonly userId: UserId; readonly email: string | null },
  occurredAt: string,
): Promise<LoginMembership | null> => {
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
