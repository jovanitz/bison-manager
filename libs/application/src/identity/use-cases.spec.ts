import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIdGenerator } from '@acme/shared';
import { accessPresetPermissions } from '@acme/domain';
import type { AccessAuditEvent, MembershipId, UserId } from '@acme/domain';
import type {
  IdentityMembershipSnapshot,
  NewIdentityMembership,
  NewIdentitySession,
} from './ports';
import { makeIdentityUseCases } from './use-cases';

const NOW = '2026-06-10T12:00:00.000Z';
const EXPIRES = '2026-07-10T12:00:00.000Z';

const makeWorld = (input: {
  bootstrapOwnerEmail?: string | null;
  rootAdminExists?: boolean;
  memberships?: Record<string, IdentityMembershipSnapshot>;
  sessions?: string[];
}) => {
  const memberships = new Map(Object.entries(input.memberships ?? {}));
  const sessions = new Set(input.sessions ?? []);
  const created: NewIdentityMembership[] = [];
  const registered: NewIdentitySession[] = [];
  const audit: AccessAuditEvent[] = [];
  let rootAdmin = input.rootAdminExists ?? false;
  const deps = {
    onboarding: {
      findMembershipByUser: async (userId: UserId) =>
        memberships.get(userId) ?? null,
      sessionExists: async (sessionId: string) => sessions.has(sessionId),
      rootAdminExists: async () => rootAdmin,
      createOwnerMembership: async (
        membership: NewIdentityMembership,
        event: AccessAuditEvent,
      ) => {
        created.push(membership);
        audit.push(event);
        rootAdmin = true;
      },
      createCustomerMembership: async (membership: NewIdentityMembership) => {
        created.push(membership);
      },
      createSession: async (
        session: NewIdentitySession,
        event: AccessAuditEvent,
      ) => {
        registered.push(session);
        sessions.add(session.sessionId);
        audit.push(event);
      },
    },
    clock: fixedClock(new Date(NOW)),
    ids: sequentialIdGenerator('id'),
    bootstrapOwnerEmail: input.bootstrapOwnerEmail ?? null,
  };
  return { deps, created, registered, audit };
};

const register = (world: ReturnType<typeof makeWorld>, email: string | null) =>
  makeIdentityUseCases(world.deps).registerIdentitySession({
    userId: 'user-1',
    sessionId: 'session-1',
    email,
    sessionExpiresAt: EXPIRES,
  });

describe('registerIdentitySession', () => {
  it('is idempotent for a session that already exists', async () => {
    const world = makeWorld({ sessions: ['session-1'] });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    expect(world.registered).toHaveLength(0);
    expect(world.audit).toHaveLength(0);
  });

  it('registers the session with login.succeeded for a known membership', async () => {
    const world = makeWorld({
      memberships: {
        'user-1': {
          membershipId: 'membership-9' as MembershipId,
          accountId: 'acct-9' as IdentityMembershipSnapshot['accountId'],
        },
      },
    });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    expect(world.created).toHaveLength(0);
    expect(world.registered[0]?.membershipId).toBe('membership-9');
    expect(world.registered[0]?.expiresAt).toBe(EXPIRES);
    expect(world.audit.map((e) => e.type)).toEqual(['login.succeeded']);
  });

  it('bootstraps the owner exactly when the env email matches and no root admin exists', async () => {
    const world = makeWorld({ bootstrapOwnerEmail: 'Owner@Example.com' });
    const r = await register(world, 'owner@example.com');
    expect(r.ok).toBe(true);
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('owner'),
    );
    expect(world.audit.map((e) => e.type)).toEqual([
      'owner.bootstrapped',
      'login.succeeded',
    ]);
  });

  it('never bootstraps twice: with a root admin present the same email becomes a customer', async () => {
    const world = makeWorld({
      bootstrapOwnerEmail: 'owner@example.com',
      rootAdminExists: true,
    });
    await register(world, 'owner@example.com');
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('customer'),
    );
    expect(world.audit.map((e) => e.type)).toEqual(['login.succeeded']);
  });

  it('provisions unknown identities as customers (also without email)', async () => {
    const world = makeWorld({ bootstrapOwnerEmail: 'owner@example.com' });
    const r = await register(world, null);
    expect(r.ok).toBe(true);
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('customer'),
    );
    expect(world.registered[0]?.membershipId).toBe(
      world.created[0]?.membershipId,
    );
  });

  it('rejects blank identity ids', async () => {
    const world = makeWorld({});
    const r = await makeIdentityUseCases(world.deps).registerIdentitySession({
      userId: '  ',
      sessionId: 'session-1',
      email: null,
      sessionExpiresAt: EXPIRES,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-access-id');
  });
});
