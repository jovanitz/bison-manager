import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { AccessInvitationRevoked } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../../access/testing';
import type { PendingInvitationSummary } from '../ports';
import { makeRevokeInvitation } from './pending';

const PENDING: PendingInvitationSummary = {
  invitationId: 'inv-1' as PendingInvitationSummary['invitationId'],
  accountId: 'acct-1' as PendingInvitationSummary['accountId'],
  email: 'a@example.com',
  createdAt: TEST_ACCESS_NOW,
  expiresAt: '2099-01-01T00:00:00.000Z',
  seatBlockedAt: null,
};

const makeWorld = (pending: PendingInvitationSummary | null) => {
  const revoked: Array<{ id: string; event: AccessInvitationRevoked }> = [];
  const revoke = makeRevokeInvitation({
    invitations: {
      listPending: async () => [],
      regenerateToken: async () => true,
      findPendingById: async () => pending,
      revokeInvitation: async (id, event) => {
        if (!pending) return false;
        revoked.push({ id, event });
        return true;
      },
    },
    tokens: { issue: () => ({ token: 't', tokenHash: 'h' }) },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  });
  return { revoke, revoked };
};

describe('revokeInvitation', () => {
  it('withdraws a pending invitation and audits it in the same write', async () => {
    const world = makeWorld(PENDING);
    const result = await world.revoke({
      actor: testAccessActor({ preset: 'owner' }),
      invitationId: 'inv-1',
    });
    expect(result.ok).toBe(true);
    expect(world.revoked).toHaveLength(1);
    // The event is what makes the revoke auditable — the store persists the
    // revocation and this together, so an unaudited revoke is unrepresentable.
    expect(world.revoked[0]?.event).toMatchObject({
      type: 'invitation.revoked',
      invitationId: 'inv-1',
      accountId: 'acct-1',
      email: 'a@example.com',
    });
  });

  it('is not-found when nothing pending matches (unknown / accepted / revoked)', async () => {
    const world = makeWorld(null);
    const result = await world.revoke({
      actor: testAccessActor({ preset: 'owner' }),
      invitationId: 'inv-gone',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/invitation-not-found');
    expect(world.revoked).toHaveLength(0);
  });

  it('denies a plain customer — and never writes', async () => {
    const world = makeWorld(PENDING);
    const result = await world.revoke({
      actor: testAccessActor({ preset: 'customer' }),
      invitationId: 'inv-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
    expect(world.revoked).toHaveLength(0);
  });
});
