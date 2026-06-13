import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type { AccessAuditEvent, InvitationId, UserId } from '@acme/domain';
import type { PendingAccessInvitation } from '../access-invitations/ports';
import type {
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
};

type IdentityWorldState = {
  readonly memberships: Map<string, IdentityMembershipSnapshot>;
  readonly sessions: Set<string>;
  readonly created: NewIdentityMembership[];
  readonly registered: NewIdentitySession[];
  readonly audit: AccessAuditEvent[];
  readonly accepted: InvitationId[];
  readonly capRevoked: string[];
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
  createCustomerMembership: async (membership: NewIdentityMembership) => {
    state.created.push(membership);
  },
  acceptInvitation: async (
    membership: NewIdentityMembership,
    invitationId: InvitationId,
    event: AccessAuditEvent,
  ) => {
    state.created.push(membership);
    state.accepted.push(invitationId);
    state.audit.push(event);
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

export const makeIdentityWorld = (input: IdentityWorldInput) => {
  const state: IdentityWorldState = {
    memberships: new Map(Object.entries(input.memberships ?? {})),
    sessions: new Set(input.sessions ?? []),
    created: [],
    registered: [],
    audit: [],
    accepted: [],
    capRevoked: [],
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
    invitations: {
      findPendingByEmail: async () => input.pendingInvitation ?? null,
    },
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
  };
};
