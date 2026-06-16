import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import type { AccessInvitationCreated, AccountKind } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type {
  IdentityProvisioner,
  PendingAccessInvitation,
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
}) => {
  const created: Array<{
    invitation: { email: string; expiresAt: string; tokenHash: string };
    event: AccessInvitationCreated;
  }> = [];
  const consumed: string[] = [];
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
    },
    accounts: {
      findAccount: async (id) =>
        (input?.accountExists ?? true)
          ? { id, status: 'active', kind: input?.accountKind ?? 'staff' }
          : null,
    },
    tokens: {
      issue: () => ({ token: 'plain-token', tokenHash: 'hash-of-plain-token' }),
      hashOf: (token) => `hash-of-${token}`,
    },
    provisioner: input?.provisioner ?? okProvisioner,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    ids: sequentialIdGenerator('inv'),
  });
  return { useCases, created, consumed };
};

const OWN_READ = [{ action: 'customer.read', scope: 'own' }];

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

const TOKEN_INVITE: PendingInvitationByToken = {
  invitationId: 'inv-1' as PendingInvitationByToken['invitationId'],
  accountId: 'acct-1' as PendingInvitationByToken['accountId'],
  email: 'new@example.com',
};

describe('activateInvitation', () => {
  it('creates the identity for a valid token and burns it', async () => {
    const world = makeWorld({ byToken: TOKEN_INVITE });
    const r = await world.useCases.activateInvitation({
      token: 'plain-token',
      password: 'sup3r-secret',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe('new@example.com');
    expect(world.consumed).toEqual(['inv-1']);
  });

  it('fails generically on an unknown/expired/used token (no enumeration)', async () => {
    const world = makeWorld({ byToken: null });
    const r = await world.useCases.activateInvitation({
      token: 'whatever',
      password: 'sup3r-secret',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invitation-token-invalid');
    expect(world.consumed).toEqual([]);
  });

  it('refuses when the email already has an identity (no takeover), token intact', async () => {
    const world = makeWorld({
      byToken: TOKEN_INVITE,
      provisioner: {
        createIdentity: async () => ({
          ok: false,
          error: {
            tag: 'app/identity-already-exists',
            message: 'exists',
          },
        }),
      },
    });
    const r = await world.useCases.activateInvitation({
      token: 'plain-token',
      password: 'sup3r-secret',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/identity-already-exists');
    expect(world.consumed).toEqual([]);
  });
});
