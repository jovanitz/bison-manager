import type {
  AccessInvitationStore,
  PendingInvitationSummary,
} from '@acme/application';
import { appendInMemoryAuditRecord } from './in-memory-audit-trail';
import type { AccessStoreState } from './in-memory-access-seed';

const pendingSummaries = (
  state: AccessStoreState,
  now: string,
): ReadonlyArray<PendingInvitationSummary> =>
  [...state.invitations.values()]
    .filter(
      (i) =>
        i.acceptedAt === null &&
        new Date(i.expiresAt).getTime() > new Date(now).getTime(),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((i) => ({
      invitationId: i.invitationId,
      accountId: i.accountId as never,
      email: i.email,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      seatBlockedAt: i.seatBlockedAt,
    }));

const findPendingByEmail = (
  state: AccessStoreState,
  email: string,
  now: string,
): ReturnType<AccessInvitationStore['findPendingByEmail']> => {
  const needle = email.trim().toLowerCase();
  for (const invitation of state.invitations.values()) {
    if (
      invitation.email === needle &&
      invitation.acceptedAt === null &&
      new Date(invitation.expiresAt).getTime() > new Date(now).getTime()
    ) {
      return Promise.resolve({
        invitationId: invitation.invitationId,
        accountId: invitation.accountId as never,
        accountKind: state.customers.has(invitation.accountId)
          ? ('customer' as const)
          : ('staff' as const),
        permissions: invitation.permissions,
        roleIds: invitation.roleIds as never,
        seatBlockedAt: invitation.seatBlockedAt,
      });
    }
  }
  return Promise.resolve(null);
};

/** In-memory invitations, sharing the store state (same rules as Postgres). */
export const makeInMemoryInvitationStore = (
  state: AccessStoreState,
): AccessInvitationStore => ({
  createInvitation: async (invitation, event) => {
    state.invitations.set(invitation.invitationId, {
      invitationId: invitation.invitationId,
      accountId: invitation.accountId,
      email: invitation.email,
      permissions: invitation.permissions,
      roleIds: invitation.roleIds,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: null,
      tokenHash: invitation.tokenHash,
      seatBlockedAt: null,
    });
    appendInMemoryAuditRecord(state, event);
  },

  listPending: async (now) => pendingSummaries(state, now),

  regenerateToken: async (invitationId, next) => {
    const invitation = state.invitations.get(invitationId);
    if (!invitation || invitation.acceptedAt !== null) return false;
    invitation.tokenHash = next.tokenHash;
    invitation.expiresAt = next.expiresAt;
    return true;
  },

  findPendingByTokenHash: async (tokenHash, now) => {
    for (const invitation of state.invitations.values()) {
      if (
        invitation.tokenHash === tokenHash &&
        invitation.acceptedAt === null &&
        new Date(invitation.expiresAt).getTime() > new Date(now).getTime()
      ) {
        return {
          invitationId: invitation.invitationId,
          accountId: invitation.accountId as never,
          email: invitation.email,
        };
      }
    }
    return null;
  },

  consumeToken: async (invitationId) => {
    const invitation = state.invitations.get(invitationId);
    if (invitation) invitation.tokenHash = null;
  },

  // First bounce wins: the mark records WHEN the org was first found full.
  markSeatBlocked: async (invitationId, occurredAt) => {
    const invitation = state.invitations.get(invitationId);
    if (invitation && invitation.seatBlockedAt === null) {
      invitation.seatBlockedAt = occurredAt;
    }
  },

  findPendingByEmail: (email, now) => findPendingByEmail(state, email, now),
});
