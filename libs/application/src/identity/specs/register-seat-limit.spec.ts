import { describe, expect, it } from 'vitest';
import type { AccountId } from '@acme/domain';
import type { PendingAccessInvitation } from '../../access-invitations/ports';
import { makeIdentityWorld as makeWorld } from '../testing';
import { knownCustomerMembership, pendingInvite, register } from './fixtures';

/** The ADR-0016 D1 bounce contract: invitations never reserve seats, so the
 * limit holds at attach; a bounce is marked, surfaced, and never silently
 * auto-attached later once the user holds any other membership. */
describe('registerIdentitySession — attach-time seat limit', () => {
  const customerInvite = (over?: Partial<PendingAccessInvitation>) =>
    pendingInvite({
      accountId: 'acct-clinic' as AccountId,
      accountKind: 'customer',
      permissions: [],
      ...over,
    });

  it('attaches below the ceiling, passing the resolved seat limit through', async () => {
    const world = makeWorld({
      pendingInvitation: customerInvite(),
      invitedOrgSeatLimit: 3,
      invitedOrgMembers: 2,
    });
    const r = await register(world, 'invitee@example.com');
    expect(r.ok && r.value.sessionId).not.toBeNull();
    expect(world.accepted).toEqual(['inv-1']);
    expect(world.seatLimitCalls).toEqual([
      { accountId: 'acct-clinic', kind: 'customer' },
    ]);
    expect(world.seatBlockedMarks).toEqual([]);
  });

  it('bounces at the ceiling: invitation marked, login proceeds org-less', async () => {
    const world = makeWorld({
      pendingInvitation: customerInvite(),
      invitedOrgSeatLimit: 3,
      invitedOrgMembers: 3,
    });
    const r = await register(world, 'invitee@example.com');
    // the login itself succeeds; there is just no membership to bind to
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sessionId).toBeNull();
      expect(r.value.seatBlockedAccountId).toBe('acct-clinic');
    }
    expect(world.accepted).toEqual([]); // nothing attached, still pending
    expect(world.created).toHaveLength(0);
    expect(world.seatBlockedMarks).toEqual(['inv-1']);
  });

  it('bounces at the ceiling but still binds an existing membership', async () => {
    const world = makeWorld({
      memberships: knownCustomerMembership,
      pendingInvitation: customerInvite(),
      invitedOrgSeatLimit: 3,
      invitedOrgMembers: 3,
    });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sessionId).not.toBeNull();
      expect(r.value.seatBlockedAccountId).toBe('acct-clinic');
    }
    // falls through to the EXISTING membership; the invitation stays pending
    expect(world.registered[0]?.membershipId).toBe('membership-9');
    expect(world.seatBlockedMarks).toEqual(['inv-1']);
  });

  it('never late-auto-attaches a bounced invitation once the user holds a membership', async () => {
    const world = makeWorld({
      memberships: knownCustomerMembership,
      pendingInvitation: customerInvite({
        seatBlockedAt: '2026-06-09T00:00:00.000Z',
      }),
      invitedOrgSeatLimit: 3,
      invitedOrgMembers: 1, // a seat HAS freed — still no silent attach
    });
    const r = await register(world, 'a@example.com');
    expect(r.ok).toBe(true);
    // skipped entirely: no accept attempt, no re-mark, no bounce re-surfaced
    expect(world.seatLimitCalls).toEqual([]);
    expect(world.accepted).toEqual([]);
    expect(world.seatBlockedMarks).toEqual([]);
    expect(world.registered[0]?.membershipId).toBe('membership-9');
    if (r.ok) expect(r.value.seatBlockedAccountId).toBeUndefined();
  });

  it('lets a still org-less user retry a bounced invitation once a seat frees', async () => {
    const world = makeWorld({
      pendingInvitation: customerInvite({
        seatBlockedAt: '2026-06-09T00:00:00.000Z',
      }),
      invitedOrgSeatLimit: 3,
      invitedOrgMembers: 2,
    });
    const r = await register(world, 'invitee@example.com');
    expect(r.ok && r.value.sessionId).not.toBeNull();
    expect(world.accepted).toEqual(['inv-1']);
    expect(world.created[0]?.accountId).toBe('acct-clinic');
  });

  it('staff orgs are unlimited: the guard resolves null, members never block', async () => {
    const world = makeWorld({
      pendingInvitation: pendingInvite(), // staff org
      invitedOrgSeatLimit: 0, // would block any customer org
      invitedOrgMembers: 50,
    });
    const r = await register(world, 'invitee@example.com');
    expect(r.ok && r.value.sessionId).not.toBeNull();
    expect(world.accepted).toEqual(['inv-1']);
    // the exemption is the guard's: it saw a STAFF ref and returned null
    expect(world.seatLimitCalls).toEqual([
      { accountId: 'acct-owner', kind: 'staff' },
    ]);
  });
});
