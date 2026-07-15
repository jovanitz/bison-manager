import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type {
  AccountId,
  InvitationId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  ACCESS_CONTRACT_SESSION_EXPIRES as EXPIRES,
  accessContractSeed,
  makeAccessContractIds,
} from './access-store-fixtures';
import type {
  AccessContractIds,
  AccessStorePorts,
} from './access-store-fixtures';
import { customerBirth } from './identity/fixtures';

/** Joins a second member to the support account (invitation-accept path). */
const joinSecondMember = async (
  store: AccessStorePorts,
  ids: AccessContractIds,
): Promise<MembershipId> => {
  const membershipId = crypto.randomUUID() as MembershipId;
  await store.onboarding.acceptInvitation(
    {
      membershipId,
      accountId: ids.acctSupport,
      userId: ids.userNew,
      email: 'second@example.com',
      displayName: 'second@example.com',
      permissions: accessPresetPermissions('customer'),
      occurredAt: NOW,
    },
    { invitationId: crypto.randomUUID() as InvitationId, seatLimit: null },
    {
      type: 'invitation.accepted',
      invitationId: crypto.randomUUID() as InvitationId,
      accountId: ids.acctSupport,
      membershipId,
      userId: ids.userNew,
      occurredAt: NOW,
    },
  );
  return membershipId;
};

/**
 * Contract for the member directory: listing an account's memberships and
 * removing one atomically with its sessions and the audit event. Runs inside
 * the access-store contract on every implementation.
 */
export const memberDirectoryContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`MemberDirectory contract: ${name}`, () => {
    it('lists the memberships of one account only', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const second = await joinSecondMember(store, ids);

      const members = await store.members.listMembers(ids.acctSupport);
      expect(members.map((m) => m.membershipId).sort()).toEqual(
        [ids.membershipSupport, second].sort(),
      );
      expect(
        members.find((m) => m.membershipId === second)?.permissions,
      ).toEqual(accessPresetPermissions('customer'));
      expect(
        await store.members.listMembers(crypto.randomUUID() as AccountId),
      ).toEqual([]);
    });

    it('removes a member: sessions die with the membership, audited', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const second = await joinSecondMember(store, ids);
      const sessionId = crypto.randomUUID() as SessionId;
      await store.onboarding.createSession(
        {
          sessionId,
          membershipId: second,
          createdAt: NOW,
          expiresAt: EXPIRES,
          context: { userAgent: 'contract-agent', ipAddress: '203.0.113.7' },
        },
        {
          type: 'login.succeeded',
          userId: ids.userNew,
          sessionId,
          occurredAt: NOW,
        },
      );

      await store.members.removeMember(
        second,
        {
          type: 'member.removed',
          membershipId: second,
          accountId: ids.acctSupport,
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        },
        false,
      );

      const members = await store.members.listMembers(ids.acctSupport);
      expect(members.map((m) => m.membershipId)).toEqual([
        ids.membershipSupport,
      ]);
      expect(await store.onboarding.sessionExists(sessionId)).toBe(false);
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toContain('member.removed');
      // the untouched member keeps working
      expect(
        await store.onboarding.findMembershipByUser(ids.userSupport),
      ).not.toBeNull();
    });

    it('lists a user across organizations and re-binds their session', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      // userNew ends up in TWO accounts: joins the staff account…
      const inStaffOrg = await joinSecondMember(store, ids);
      // …and self-signs-up a customer account of their own.
      const ownOrg = crypto.randomUUID() as MembershipId;
      await customerBirth(store, {
        membershipId: ownOrg,
        accountId: crypto.randomUUID() as AccountId,
        userId: ids.userNew,
        email: 'second@example.com',
        displayName: 'Second Org',
        permissions: accessPresetPermissions('customer'),
        occurredAt: NOW,
      });

      const mine = await store.members.listMembershipsByUser(ids.userNew);
      expect(mine.map((m) => m.membershipId).sort()).toEqual(
        [inStaffOrg, ownOrg].sort(),
      );
      expect(mine.find((m) => m.membershipId === inStaffOrg)?.accountKind).toBe(
        'staff',
      );
      expect(mine.find((m) => m.membershipId === ownOrg)?.accountName).toBe(
        'Second Org',
      );

      const sessionId = crypto.randomUUID() as SessionId;
      await store.onboarding.createSession(
        {
          sessionId,
          membershipId: ownOrg,
          createdAt: NOW,
          expiresAt: EXPIRES,
          context: { userAgent: null, ipAddress: null },
        },
        {
          type: 'login.succeeded',
          userId: ids.userNew,
          sessionId,
          occurredAt: NOW,
        },
      );
      const SWITCH_EXPIRES = '2026-06-09T12:30:00.000Z';
      await store.members.switchSession(sessionId, inStaffOrg, SWITCH_EXPIRES, {
        type: 'session.switched',
        sessionId,
        fromMembershipId: ownOrg,
        toMembershipId: inStaffOrg,
        occurredAt: NOW,
      });

      const actor = await store.actors.findActorBySession(sessionId);
      expect(actor?.membership.id).toBe(inStaffOrg);
      expect(actor?.session.expiresAt).toBe(SWITCH_EXPIRES);
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toContain('session.switched');
    });
  });
};
