import type {
  AccessInvitationStore,
  PendingInvitationSummary,
} from '@acme/application';
import { appendInMemoryAuditRecord } from '../audit-trail';
import type {
  AccessStoreState,
  StoredInvitation,
} from '../access-seed';

/**
 * PENDING = not accepted, not revoked, not expired. Every lookup goes through
 * this so a revoked invitation disappears from the list AND stops activating —
 * the token must die with the revocation, not just the row.
 */
const isPending = (invitation: StoredInvitation, now: string): boolean =>
  invitation.acceptedAt === null &&
  invitation.revokedAt === null &&
  new Date(invitation.expiresAt).getTime() > new Date(now).getTime();

const toSummary = (i: StoredInvitation): PendingInvitationSummary => ({
  invitationId: i.invitationId,
  accountId: i.accountId as never,
  email: i.email,
  createdAt: i.createdAt,
  expiresAt: i.expiresAt,
  seatBlockedAt: i.seatBlockedAt,
});

const pendingSummaries = (
  state: AccessStoreState,
  now: string,
): ReadonlyArray<PendingInvitationSummary> =>
  [...state.invitations.values()]
    .filter((i) => isPending(i, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toSummary);

const findPendingByEmail = (
  state: AccessStoreState,
  email: string,
  now: string,
): ReturnType<AccessInvitationStore['findPendingByEmail']> => {
  const needle = email.trim().toLowerCase();
  for (const invitation of state.invitations.values()) {
    if (invitation.email === needle && isPending(invitation, now)) {
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
      revokedAt: null,
    });
    appendInMemoryAuditRecord(state, event);
  },

  listPending: async (now) => pendingSummaries(state, now),

  findPendingById: async (invitationId, now) => {
    const invitation = state.invitations.get(invitationId);
    return invitation && isPending(invitation, now)
      ? toSummary(invitation)
      : null;
  },

  // Revocation + its audit event land together; the token is burned so a link
  // already in someone's inbox stops working.
  revokeInvitation: async (invitationId, event) => {
    const invitation = state.invitations.get(invitationId);
    if (!invitation || !isPending(invitation, event.occurredAt)) return false;
    invitation.revokedAt = event.occurredAt;
    invitation.tokenHash = null;
    appendInMemoryAuditRecord(state, event);
    return true;
  },

  regenerateToken: async (invitationId, next, now) => {
    const invitation = state.invitations.get(invitationId);
    // A revoked (or accepted) invitation must not be resurrected by a rotate.
    if (!invitation || !isPending(invitation, now)) return false;
    invitation.tokenHash = next.tokenHash;
    invitation.expiresAt = next.expiresAt;
    return true;
  },

  findPendingByTokenHash: async (tokenHash, now) => {
    for (const invitation of state.invitations.values()) {
      if (invitation.tokenHash === tokenHash && isPending(invitation, now)) {
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
