import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type {
  AccessAuditEvent,
  BillingEvent,
  InvitationId,
  Subscription,
  UserId,
} from '@acme/domain';
import type { BillingAccountRef } from '../billing-subscriptions/ports';
import type { PendingAccessInvitation } from '../access-invitations/ports';
import type {
  AcceptInvitationTarget,
  ActiveIdentitySession,
  IdentityMembershipSnapshot,
  NewIdentityMembership,
  NewIdentitySession,
  SessionContext,
} from './ports';

/** Spec fixtures for the identity module (imported from `*.spec.ts` only). */
export const IDENTITY_TEST_NOW = '2026-06-10T12:00:00.000Z';

export const IDENTITY_TEST_CONTEXT: SessionContext = {
  userAgent: 'spec-agent',
  ipAddress: '198.51.100.4',
};

type IdentityWorldInput = {
  bootstrapOwnerEmail?: string | null;
  rootAdminExists?: boolean;
  memberships?: Record<string, IdentityMembershipSnapshot>;
  sessions?: string[];
  activeSessions?: ReadonlyArray<ActiveIdentitySession>;
  pendingInvitation?: PendingAccessInvitation;
  /** Members already in the invited org — the attach-time count (ADR-0016). */
  invitedOrgMembers?: number;
  /** Seat ceiling `seatLimitFor` resolves for CUSTOMER orgs (null = unlimited). */
  invitedOrgSeatLimit?: number | null;
};

type IdentityWorldState = {
  readonly memberships: Map<string, IdentityMembershipSnapshot>;
  readonly sessions: Set<string>;
  readonly created: NewIdentityMembership[];
  readonly registered: NewIdentitySession[];
  readonly audit: AccessAuditEvent[];
  readonly accepted: InvitationId[];
  readonly capRevoked: string[];
  readonly subscriptions: Subscription[];
  readonly billingEvents: BillingEvent[];
  readonly seatBlockedMarks: InvitationId[];
  readonly seatLimitCalls: BillingAccountRef[];
  readonly root: { exists: boolean };
};

const makeOnboardingFake = (
  input: IdentityWorldInput,
  state: IdentityWorldState,
) => ({
  findMembershipByUser: async (userId: UserId) =>
    state.memberships.get(userId) ?? null,
  sessionExists: async (sessionId: string) => state.sessions.has(sessionId),
  rootAdminExists: async () => state.root.exists,
  createOwnerMembership: async (
    membership: NewIdentityMembership,
    event: AccessAuditEvent,
  ) => {
    state.created.push(membership);
    state.audit.push(event);
    state.root.exists = true;
  },
  createCustomerMembership: async (
    membership: NewIdentityMembership,
    subscription: Subscription,
    event: BillingEvent,
  ) => {
    state.created.push(membership);
    state.subscriptions.push(subscription);
    state.billingEvents.push(event);
  },
  // Mirrors the adapters: at the seat ceiling nothing is written (the bounce).
  acceptInvitation: async (
    membership: NewIdentityMembership,
    invitation: AcceptInvitationTarget,
    event: AccessAuditEvent,
  ) => {
    const members = input.invitedOrgMembers ?? 0;
    if (invitation.seatLimit !== null && members >= invitation.seatLimit) {
      return 'seat-blocked' as const;
    }
    state.created.push(membership);
    state.accepted.push(invitation.invitationId);
    state.audit.push(event);
    return 'attached' as const;
  },
  createSession: async (
    session: NewIdentitySession,
    event: AccessAuditEvent,
  ) => {
    state.registered.push(session);
    state.sessions.add(session.sessionId);
    state.audit.push(event);
  },
  listActiveSessions: async (): Promise<ReadonlyArray<ActiveIdentitySession>> =>
    input.activeSessions ?? [],
});

const makeInvitationFakes = (
  input: IdentityWorldInput,
  state: IdentityWorldState,
) => ({
  invitations: {
    findPendingByEmail: async () => input.pendingInvitation ?? null,
    markSeatBlocked: async (invitationId: InvitationId) => {
      state.seatBlockedMarks.push(invitationId);
    },
  },
  // Mirrors the real guard: staff orgs are never billing-gated (null).
  billing: {
    seatLimitFor: async (account: BillingAccountRef) => {
      state.seatLimitCalls.push(account);
      if (account.kind === 'staff') return null;
      return input.invitedOrgSeatLimit ?? null;
    },
  },
});

export const makeIdentityWorld = (input: IdentityWorldInput) => {
  const state: IdentityWorldState = {
    memberships: new Map(Object.entries(input.memberships ?? {})),
    sessions: new Set(input.sessions ?? []),
    created: [],
    registered: [],
    audit: [],
    accepted: [],
    capRevoked: [],
    subscriptions: [],
    billingEvents: [],
    seatBlockedMarks: [],
    seatLimitCalls: [],
    root: { exists: input.rootAdminExists ?? false },
  };
  const deps = {
    onboarding: makeOnboardingFake(input, state),
    sessions: {
      revokeSession: async (sessionId: string, event: AccessAuditEvent) => {
        state.capRevoked.push(sessionId);
        state.audit.push(event);
      },
    },
    ...makeInvitationFakes(input, state),
    members: {
      // mirrors the memberships record: one membership per seeded user
      listMembershipsByUser: async (userId: UserId) => {
        const existing = state.memberships.get(userId);
        return existing
          ? [
              {
                membershipId: existing.membershipId,
                accountId: existing.accountId,
                accountKind: existing.accountKind,
                accountStatus: 'active' as const,
                accountName: null,
              },
            ]
          : [];
      },
    },
    sessionPolicies: {
      loadSessionPolicies: async () => ACCESS_SESSION_POLICY_DEFAULTS,
    },
    clock: fixedClock(new Date(IDENTITY_TEST_NOW)),
    ids: sequentialIdGenerator('id'),
    bootstrapOwnerEmail: input.bootstrapOwnerEmail ?? null,
  };
  return {
    deps,
    created: state.created,
    registered: state.registered,
    audit: state.audit,
    capRevoked: state.capRevoked,
    accepted: state.accepted,
    subscriptions: state.subscriptions,
    billingEvents: state.billingEvents,
    seatBlockedMarks: state.seatBlockedMarks,
    seatLimitCalls: state.seatLimitCalls,
  };
};
