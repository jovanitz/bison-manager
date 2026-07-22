import { describe, expect, it } from 'vitest';
import type { Role, RoleId } from '@acme/domain';
import { testAccessActor } from '../access/testing';
import type { PendingAccessInvitation } from './ports';
import { EXPIRES, OWN_READ, makeWorld, roleFixture } from './use-cases.testkit';

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

  it('refuses attaching a platform role with any-scoped powers to a customer account (privilege escalation)', async () => {
    // The audit finding: a customer-org admin attaches the seeded platform
    // "Support" role (accountId null, so it passes the foreign check) whose
    // permissions are any-scoped impersonation/customer.read — smuggling
    // staff-grade cross-org powers INTO a customer account. The role path must
    // obey the SAME coherence law as the direct `permissions` field.
    const supportRole: Role = {
      id: 'support' as RoleId,
      name: 'Support' as Role['name'],
      accountId: null,
      permissions: [
        { action: 'customer.read', scope: 'any' },
        { action: 'impersonation.start', scope: 'any' },
      ] as Role['permissions'],
    };
    const world = makeWorld({ accountKind: 'customer', roles: [supportRole] });
    const r = await world.useCases.createInvitation({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-1',
      email: 'attacker@example.com',
      permissions: [],
      roleIds: ['support'],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/requires-staff-account');
    expect(world.created).toHaveLength(0);
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
