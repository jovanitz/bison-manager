import type { AccessInvitationStore } from '@acme/application';
import { appendInMemoryAuditRecord } from './in-memory-audit-trail';
import type { AccessStoreState } from './in-memory-access-seed';

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
      expiresAt: invitation.expiresAt,
      acceptedAt: null,
    });
    appendInMemoryAuditRecord(state, event);
  },

  findPendingByEmail: async (email, now) => {
    const needle = email.trim().toLowerCase();
    for (const invitation of state.invitations.values()) {
      if (
        invitation.email === needle &&
        invitation.acceptedAt === null &&
        new Date(invitation.expiresAt).getTime() > new Date(now).getTime()
      ) {
        return {
          invitationId: invitation.invitationId,
          accountId: invitation.accountId as never,
          accountKind: state.customers.has(invitation.accountId)
            ? ('customer' as const)
            : ('staff' as const),
          permissions: invitation.permissions,
        };
      }
    }
    return null;
  },
});
