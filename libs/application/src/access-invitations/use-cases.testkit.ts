import { fixedClock, ok, sequentialIdGenerator } from '@acme/shared';
import type {
  AccessInvitationCreated,
  AccessInvitationRevoked,
  AccountKind,
  Role,
  RoleId,
} from '@acme/domain';
import { TEST_ACCESS_NOW } from '../access/testing';
import type {
  IdentityProvisioner,
  PendingAccessInvitation,
  PendingInvitationSummary,
  PendingInvitationByToken,
} from './ports';
import { makeAccessInvitationsUseCases } from './use-cases';

/** Shared fixtures + world builder for the access-invitations specs. */
export const EXPIRES = '2026-06-16T12:00:00.000Z'; // TEST_ACCESS_NOW + 7 days

export const okProvisioner: IdentityProvisioner = {
  createIdentity: async () => ({ ok: true, value: { userId: 'user-new' } }),
};

export const OWN_READ = [{ action: 'customer.read', scope: 'own' }];

export const roleFixture = (id: string): Role => ({
  id: id as RoleId,
  name: id as Role['name'],
  accountId: null,
  permissions: [] as Role['permissions'],
  templateKey: null,
  templateSynced: true,
  isPersonal: false,
});

export const makeWorld = (input?: {
  accountKind?: AccountKind;
  accountExists?: boolean;
  pending?: PendingAccessInvitation;
  byToken?: PendingInvitationByToken | null;
  provisioner?: IdentityProvisioner;
  roles?: ReadonlyArray<Role>;
  pendingById?: PendingInvitationSummary | null;
}) => {
  const created: Array<{
    invitation: { email: string; expiresAt: string; tokenHash: string };
    event: AccessInvitationCreated;
  }> = [];
  const consumed: string[] = [];
  const revoked: Array<{ id: string; event: AccessInvitationRevoked }> = [];
  const useCases = makeAccessInvitationsUseCases({
    invitations: {
      createInvitation: async (invitation, event) => {
        created.push({ invitation, event });
      },
      findPendingByEmail: async () => input?.pending ?? null,
      findPendingByTokenHash: async () => input?.byToken ?? null,
      consumeToken: async (id) => {
        consumed.push(id);
      },
      listPending: async () => [],
      regenerateToken: async () => true,
      findPendingById: async () => input?.pendingById ?? null,
      revokeInvitation: async (id, event) => {
        if (!(input?.pendingById ?? null)) return false;
        revoked.push({ id, event });
        return true;
      },
      markSeatBlocked: async () => undefined,
    },
    accounts: {
      findAccount: async (id) =>
        (input?.accountExists ?? true)
          ? {
              id,
              status: 'active' as const,
              kind: input?.accountKind ?? 'staff',
              hostsRoot: false,
              pendingDeletionUntil: null,
            }
          : null,
    },
    roles: {
      findManyById: async (roleIds) =>
        (input?.roles ?? []).filter((role) => roleIds.includes(role.id)),
    },
    tokens: {
      issue: () => ({ token: 'plain-token', tokenHash: 'hash-of-plain-token' }),
      hashOf: (token) => `hash-of-${token}`,
    },
    notifications: { send: async () => ok(undefined) },
    links: {
      activationUrl: (token) => `https://app.test/activate?token=${token}`,
    },
    provisioner: input?.provisioner ?? okProvisioner,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    ids: sequentialIdGenerator('inv'),
  });
  return { useCases, created, consumed, revoked };
};
