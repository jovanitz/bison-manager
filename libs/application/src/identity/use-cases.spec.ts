import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type { AccountId, InvitationId, MembershipId } from '@acme/domain';
import type {
  ActiveIdentitySession,
  IdentityMembershipSnapshot,
} from './ports';
import {
  IDENTITY_TEST_CONTEXT,
  makeIdentityWorld as makeWorld,
} from './testing';
import { makeIdentityUseCases } from './use-cases';

const CUSTOMER_EXPIRES = '2026-06-11T12:00:00.000Z'; // NOW + 24 h idle
const STAFF_EXPIRES = '2026-06-10T12:30:00.000Z'; // NOW + 30 min idle

const knownCustomerMembership: Record<string, IdentityMembershipSnapshot> = {
  'user-1': {
    membershipId: 'membership-9' as MembershipId,
    accountId: 'acct-9' as AccountId,
    accountKind: 'customer',
  },
};

const register = (world: ReturnType<typeof makeWorld>, email: string | null) =>
  makeIdentityUseCases(world.deps).registerIdentitySession({
    userId: 'user-1',
    sessionId: 'session-1',
    email,
    context: IDENTITY_TEST_CONTEXT,
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
    const world = makeWorld({ memberships: knownCustomerMembership });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    expect(world.created).toHaveLength(0);
    expect(world.registered[0]?.membershipId).toBe('membership-9');
    expect(world.registered[0]?.expiresAt).toBe(CUSTOMER_EXPIRES);
    expect(world.registered[0]?.context).toEqual(IDENTITY_TEST_CONTEXT);
    expect(world.audit.map((e) => e.type)).toEqual(['login.succeeded']);
  });

  it('revokes the least-recently-seen session when the cap is exceeded', async () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      sessionId: `session-old-${i}` as ActiveIdentitySession['sessionId'],
      lastSeenAt: `2026-06-10T0${i}:00:00.000Z`,
    }));
    const world = makeWorld({
      memberships: knownCustomerMembership,
      activeSessions: five,
    });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    // 5 active + 1 new > cap of 5 → the oldest one goes, audited
    expect(world.capRevoked).toEqual(['session-old-0']);
    expect(world.audit.map((e) => e.type)).toEqual([
      'session.revoked',
      'login.succeeded',
    ]);
  });

  it('bootstraps the owner exactly when the env email matches and no root admin exists', async () => {
    const world = makeWorld({ bootstrapOwnerEmail: 'Owner@Example.com' });
    const r = await register(world, 'owner@example.com');
    expect(r.ok).toBe(true);
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('owner'),
    );
    // staff session policy: strict 30-minute idle window
    expect(world.registered[0]?.expiresAt).toBe(STAFF_EXPIRES);
    expect(world.audit.map((e) => e.type)).toEqual([
      'owner.bootstrapped',
      'login.succeeded',
    ]);
  });

  it('never bootstraps twice: with a root admin present the email is left org-less', async () => {
    const world = makeWorld({
      bootstrapOwnerEmail: 'owner@example.com',
      rootAdminExists: true,
    });
    const r = await register(world, 'owner@example.com');
    // not bootstrapped (root exists) and not invited ⇒ no membership, no session
    expect(r.ok && r.value.sessionId).toBeNull();
    expect(world.created).toHaveLength(0);
    expect(world.audit).toHaveLength(0);
  });

  it('a pending invitation joins the existing account, beating bootstrap and self-signup', async () => {
    const world = makeWorld({
      // even the bootstrap email defers to an invitation
      bootstrapOwnerEmail: 'invitee@example.com',
      pendingInvitation: {
        invitationId: 'inv-1' as InvitationId,
        accountId: 'acct-owner' as AccountId,
        accountKind: 'staff',
        permissions: accessPresetPermissions('support'),
      },
    });
    const r = await register(world, 'invitee@example.com');
    expect(r.ok).toBe(true);
    // joins the inviting account with the invited permissions — no new account
    expect(world.created[0]?.accountId).toBe('acct-owner');
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('support'),
    );
    expect(world.accepted).toEqual(['inv-1']);
    // a staff account ⇒ strict staff session policy from the first login
    expect(world.registered[0]?.expiresAt).toBe(STAFF_EXPIRES);
    expect(world.audit.map((e) => e.type)).toEqual([
      'invitation.accepted',
      'login.succeeded',
    ]);
  });

  it('a user with an existing membership still joins the inviting account', async () => {
    const world = makeWorld({
      memberships: knownCustomerMembership,
      pendingInvitation: {
        invitationId: 'inv-1' as InvitationId,
        accountId: 'acct-owner' as AccountId,
        accountKind: 'staff',
        permissions: accessPresetPermissions('support'),
      },
    });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    // a SECOND membership: joined the inviting account, original untouched
    expect(world.accepted).toEqual(['inv-1']);
    expect(world.created[0]?.accountId).toBe('acct-owner');
    // the fresh session acts as the invited membership
    expect(world.registered[0]?.membershipId).toBe(
      world.created[0]?.membershipId,
    );
    expect(world.audit.map((e) => e.type)).toEqual([
      'invitation.accepted',
      'login.succeeded',
    ]);
  });

  it('ignores an invitation into an account the user already belongs to', async () => {
    const world = makeWorld({
      memberships: knownCustomerMembership,
      pendingInvitation: {
        invitationId: 'inv-1' as InvitationId,
        accountId: 'acct-9' as AccountId, // same account as the membership
        accountKind: 'customer',
        permissions: [],
      },
    });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    expect(world.accepted).toEqual([]);
    expect(world.created).toHaveLength(0);
    expect(world.registered[0]?.membershipId).toBe('membership-9');
  });

  it('leaves an unknown identity org-less (no auto-provisioned customer org)', async () => {
    const world = makeWorld({ bootstrapOwnerEmail: 'owner@example.com' });
    const r = await register(world, 'stranger@example.com');
    expect(r.ok && r.value.sessionId).toBeNull();
    expect(world.created).toHaveLength(0);
    expect(world.registered).toHaveLength(0);
  });

  it('rejects blank identity ids', async () => {
    const world = makeWorld({});
    const r = await makeIdentityUseCases(world.deps).registerIdentitySession({
      userId: '  ',
      sessionId: 'session-1',
      email: null,
      context: IDENTITY_TEST_CONTEXT,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-access-id');
  });
});
