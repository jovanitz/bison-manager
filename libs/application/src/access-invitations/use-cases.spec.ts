import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import type {
  AccessInvitationCreated,
  AccessInvitationRevoked,
  AccountKind,
  Role,
  RoleId,
} from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type {
  IdentityProvisioner,
  PendingAccessInvitation,
  PendingInvitationSummary,
  PendingInvitationByToken,
} from './ports';
import { makeAccessInvitationsUseCases } from './use-cases';

const EXPIRES = '2026-06-16T12:00:00.000Z'; // TEST_ACCESS_NOW + 7 days

const okProvisioner: IdentityProvisioner = {
  createIdentity: async () => ({ ok: true, value: { userId: 'user-new' } }),
};

const makeWorld = (input?: {
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
    },
    accounts: {
      findAccount: async (id) =>
        (input?.accountExists ?? true)
          ? { id, status: 'active', kind: input?.accountKind ?? 'staff' }
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
    provisioner: input?.provisioner ?? okProvisioner,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    ids: sequentialIdGenerator('inv'),
  });
  return { useCases, created, consumed, revoked };
};

const OWN_READ = [{ action: 'customer.read', scope: 'own' }];

const roleFixture = (id: string): Role => ({
  id: id as RoleId,
  name: id as Role['name'],
  accountId: null,
  permissions: [] as Role['permissions'],
});

describe('createInvitation', () => {
  it('lets an owner invite an email, normalized and audited atomically', async () => {
    const world = makeWorld();
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: '  New.Member@Example.COM ',
      permissions: OWN_READ,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.token).toBe('plain-token');
    expect(world.created).toHaveLength(1);
    expect(world.created[0]?.invitation.email).toBe('new.member@example.com');
    expect(world.created[0]?.invitation.tokenHash).toBe('hash-of-plain-token');
    expect(world.created[0]?.invitation.expiresAt).toBe(EXPIRES);
    expect(world.created[0]?.event.type).toBe('invitation.created');
    expect(world.created[0]?.event.actorMembershipId).toBe('membership-1');
  });

  it('denies actors without members.invite', async () => {
    const world = makeWorld();
    for (const preset of ['support', 'customer'] as const) {
      const r = await world.useCases.createInvitation({
        actor: testAccessActor({ preset }),
        accountId: 'acct-1',
        email: 'a@example.com',
        permissions: OWN_READ,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
    expect(world.created).toHaveLength(0);
  });

  it('attaches valid roles (de-duplicated) to the invitation', async () => {
    const world = makeWorld({ roles: [roleFixture('r1')] });
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: 'roled@example.com',
      permissions: [],
      roleIds: ['r1', 'r1'],
    });
    expect(r.ok).toBe(true);
    expect(world.created[0]?.event.roleIds).toEqual(['r1']);
  });

  it('rejects an invitation referencing an unknown role', async () => {
    const world = makeWorld();
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: 'roled@example.com',
      permissions: [],
      roleIds: ['ghost'],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invitation-role-invalid');
    expect(world.created).toHaveLength(0);
  });

  it('rejects malformed emails before touching any port', async () => {
    const world = makeWorld();
    for (const email of [
      'nope',
      'two@@example.com',
      'a b@example.com',
      '@x.com',
    ]) {
      const r = await world.useCases.createInvitation({
        actor: testAccessActor({ preset: 'owner' }),
        accountId: 'acct-1',
        email,
        permissions: OWN_READ,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/invalid-invitation-email');
    }
  });

  it('rejects unknown accounts', async () => {
    const world = makeWorld({ accountExists: false });
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-missing',
      email: 'a@example.com',
      permissions: OWN_READ,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-not-found');
  });

  it('refuses any-scoped permissions into a customer account (coherence rule)', async () => {
    const world = makeWorld({ accountKind: 'customer' });
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: 'a@example.com',
      permissions: [{ action: 'customer.read', scope: 'any' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/requires-staff-account');
  });

  it('refuses inviting staff-only actions into a customer organization', async () => {
    const world = makeWorld({ accountKind: 'customer' });
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: 'a@example.com',
      permissions: [{ action: 'settings.update', scope: 'own' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/not-delegable-to-customer');
  });

  it('refuses a second invitation while one is pending for the email', async () => {
    const world = makeWorld({
      pending: {
        invitationId: 'inv-0' as PendingAccessInvitation['invitationId'],
        accountId: 'acct-1' as PendingAccessInvitation['accountId'],
        accountKind: 'staff',
        permissions: [],
      },
    });
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: 'a@example.com',
      permissions: OWN_READ,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invitation-already-pending');
  });
});
