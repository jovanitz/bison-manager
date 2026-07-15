import { describe, expect, it } from 'vitest';
import type { InvitationId, MembershipId } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../../access/in-memory/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  accessContractSeed,
  makeAccessContractIds,
} from '../access-store-fixtures';
import type {
  AccessContractIds,
  AccessStorePorts,
} from '../access-store-fixtures';

const INVITE_EXPIRES = '2026-07-09T12:00:00.000Z';

/** One pending customer-org invitation, ready to accept. */
const seedPendingInvitation = async (
  store: AccessStorePorts,
  ids: AccessContractIds,
): Promise<InvitationId> => {
  const invitationId = crypto.randomUUID() as InvitationId;
  await store.invitations.createInvitation(
    {
      invitationId,
      accountId: ids.acctCustomer,
      email: 'blocked@example.com',
      permissions: [],
      roleIds: [],
      invitedBy: ids.membershipSupport,
      createdAt: NOW,
      expiresAt: INVITE_EXPIRES,
      tokenHash: 'th-seat',
    },
    {
      type: 'invitation.created',
      invitationId,
      accountId: ids.acctCustomer,
      email: 'blocked@example.com',
      permissions: [],
      roleIds: [],
      actorMembershipId: ids.membershipSupport,
      expiresAt: INVITE_EXPIRES,
      occurredAt: NOW,
    },
  );
  return invitationId;
};

const attemptAccept = (
  store: AccessStorePorts,
  ids: AccessContractIds,
  invitationId: InvitationId,
  seatLimit: number | null,
) => {
  const membershipId = crypto.randomUUID() as MembershipId;
  return store.onboarding.acceptInvitation(
    {
      membershipId,
      accountId: ids.acctCustomer,
      userId: ids.userNew,
      email: 'blocked@example.com',
      displayName: 'blocked@example.com',
      permissions: [],
      occurredAt: NOW,
    },
    { invitationId, seatLimit },
    {
      type: 'invitation.accepted',
      invitationId,
      accountId: ids.acctCustomer,
      membershipId,
      userId: ids.userNew,
      occurredAt: NOW,
    },
  );
};

/**
 * The ADR-0016 D1 attach-time seat check: the limit is enforced inside the
 * accept transaction (count under lock); at the ceiling NOTHING is written
 * and the invitation stays pending, visibly marked once the caller records
 * the bounce.
 */
export const invitationSeatBlockContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`Invitation seat-block contract: ${name}`, () => {
    it('blocks at the ceiling, writes nothing, and attaches once a seat frees', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const invitationId = await seedPendingInvitation(store, ids);

      // acctCustomer has 0 members: a ceiling of 0 is already full.
      expect(await attemptAccept(store, ids, invitationId, 0)).toBe(
        'seat-blocked',
      );
      // nothing was written: still pending, no membership, no audit event
      const pending = await store.invitations.findPendingByEmail(
        'blocked@example.com',
        NOW,
      );
      expect(pending?.invitationId).toBe(invitationId);
      expect(await store.members.listMembers(ids.acctCustomer)).toEqual([]);
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).not.toContain('invitation.accepted');

      // the caller records the bounce → visible to admin reads
      await store.invitations.markSeatBlocked(invitationId, NOW);
      const marked = await store.invitations.findPendingByEmail(
        'blocked@example.com',
        NOW,
      );
      expect(marked?.seatBlockedAt).toBe(NOW);
      const listed = await store.invitations.listPending(NOW);
      expect(
        listed.find((i) => i.invitationId === invitationId)?.seatBlockedAt,
      ).toBe(NOW);

      // a freed seat (ceiling 1 > 0 members) lets the SAME invitation attach
      expect(await attemptAccept(store, ids, invitationId, 1)).toBe('attached');
      expect(await store.members.listMembers(ids.acctCustomer)).toHaveLength(1);
    });

    it('enforces the boundary exactly: the seat filling the org blocks the next accept', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const first = await seedPendingInvitation(store, ids);

      // ceiling 1, 0 members → the first accept attaches and FILLS the org…
      expect(await attemptAccept(store, ids, first, 1)).toBe('attached');
      // …so a back-to-back accept against the same ceiling bounces (the
      // concurrent-accept order, serialized as the account lock would).
      const second = await seedPendingInvitation(store, ids);
      expect(await attemptAccept(store, ids, second, 1)).toBe('seat-blocked');
      expect(await store.members.listMembers(ids.acctCustomer)).toHaveLength(1);
    });

    it('marks the first bounce only (first timestamp wins)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const invitationId = await seedPendingInvitation(store, ids);
      await store.invitations.markSeatBlocked(invitationId, NOW);
      await store.invitations.markSeatBlocked(
        invitationId,
        '2026-06-10T00:00:00.000Z',
      );
      const pending = await store.invitations.findPendingByEmail(
        'blocked@example.com',
        NOW,
      );
      expect(pending?.seatBlockedAt).toBe(NOW);
    });
  });
};
