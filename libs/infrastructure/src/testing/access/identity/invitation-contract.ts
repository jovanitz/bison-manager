import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type { InvitationId, MembershipId, Role, RoleId } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../../access/in-memory/seed/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  accessContractSeed,
  makeAccessContractIds,
} from '../access-store-fixtures';
import type { AccessStorePorts } from '../access-store-fixtures';
import { invitationSeatBlockContract } from './seat-block-contract';

const INVITE_EXPIRES = '2026-07-09T12:00:00.000Z';
const AFTER_EXPIRY = '2026-08-01T00:00:00.000Z';

/**
 * Contract for the invitation lifecycle: create + audit atomically, pending
 * lookup (case-insensitive, expiry-aware), and atomic consumption that joins
 * the EXISTING account. Runs inside the identity-onboarding contract.
 */
export const identityInvitationContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`Invitation contract: ${name}`, () => {
    it('created, found pending (case-insensitive), consumed atomically', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const invitationId = crypto.randomUUID() as InvitationId;
      const permissions = accessPresetPermissions('customer');
      await store.invitations.createInvitation(
        {
          invitationId,
          accountId: ids.acctCustomer,
          email: 'invitee@example.com',
          permissions,
          roleIds: [],
          invitedBy: ids.membershipSupport,
          createdAt: NOW,
          expiresAt: INVITE_EXPIRES,
          tokenHash: 'token-hash-abc',
        },
        {
          type: 'invitation.created',
          invitationId,
          accountId: ids.acctCustomer,
          email: 'invitee@example.com',
          permissions,
          roleIds: [],
          actorMembershipId: ids.membershipSupport,
          expiresAt: INVITE_EXPIRES,
          occurredAt: NOW,
        },
      );

      const pending = await store.invitations.findPendingByEmail(
        'INVITEE@example.com',
        NOW,
      );
      expect(pending).toEqual({
        invitationId,
        accountId: ids.acctCustomer,
        accountKind: 'customer',
        permissions,
        roleIds: [],
        seatBlockedAt: null,
      });
      // an expired invitation is not pending
      expect(
        await store.invitations.findPendingByEmail(
          'invitee@example.com',
          AFTER_EXPIRY,
        ),
      ).toBeNull();

      // located by token hash (the activation flow); burned, then no longer found
      expect(
        await store.invitations.findPendingByTokenHash('token-hash-abc', NOW),
      ).toEqual({
        invitationId,
        accountId: ids.acctCustomer,
        email: 'invitee@example.com',
      });
      expect(
        await store.invitations.findPendingByTokenHash('nope', NOW),
      ).toBeNull();
      await store.invitations.consumeToken(invitationId);
      expect(
        await store.invitations.findPendingByTokenHash('token-hash-abc', NOW),
      ).toBeNull();

      const membershipId = crypto.randomUUID() as MembershipId;
      const outcome = await store.onboarding.acceptInvitation(
        {
          membershipId,
          accountId: ids.acctCustomer,
          userId: ids.userNew,
          email: 'invitee@example.com',
          displayName: 'invitee@example.com',
          permissions,
          occurredAt: NOW,
        },
        { invitationId, seatLimit: null },
        {
          type: 'invitation.accepted',
          invitationId,
          accountId: ids.acctCustomer,
          membershipId,
          userId: ids.userNew,
          occurredAt: NOW,
        },
      );
      expect(outcome).toBe('attached');
      // consumed: no longer pending; membership joined the EXISTING account
      expect(
        await store.invitations.findPendingByEmail('invitee@example.com', NOW),
      ).toBeNull();
      expect(await store.onboarding.findMembershipByUser(ids.userNew)).toEqual({
        membershipId,
        accountId: ids.acctCustomer,
        accountKind: 'customer',
      });
      expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
        'invitation.created',
        'invitation.accepted',
      ]);
    });

    it('carries the invitation roles onto the accepted membership', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const role: Role = {
        id: crypto.randomUUID() as RoleId,
        name: 'Invited role' as Role['name'],
        accountId: null,
        templateKey: null,
        templateSynced: true,
        isPersonal: false,
        permissions: [
          { action: 'audit.read', scope: 'any' },
        ] as Role['permissions'],
      };
      await store.roles.create(role);

      const invitationId = crypto.randomUUID() as InvitationId;
      const base = {
        invitationId,
        accountId: ids.acctCustomer,
        email: 'roled@example.com',
        permissions: [],
        roleIds: [role.id],
        expiresAt: INVITE_EXPIRES,
      };
      await store.invitations.createInvitation(
        {
          ...base,
          invitedBy: ids.membershipSupport,
          createdAt: NOW,
          tokenHash: 'th-roled',
        },
        {
          ...base,
          type: 'invitation.created',
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        },
      );

      const pending = await store.invitations.findPendingByEmail(
        'roled@example.com',
        NOW,
      );
      expect(pending?.roleIds).toEqual([role.id]);

      const membershipId = crypto.randomUUID() as MembershipId;
      await store.onboarding.acceptInvitation(
        {
          membershipId,
          accountId: ids.acctCustomer,
          userId: ids.userNew,
          email: 'roled@example.com',
          displayName: 'roled@example.com',
          permissions: [],
          roleIds: pending?.roleIds ?? [],
          occurredAt: NOW,
        },
        { invitationId, seatLimit: null },
        {
          type: 'invitation.accepted',
          invitationId,
          accountId: ids.acctCustomer,
          membershipId,
          userId: ids.userNew,
          occurredAt: NOW,
        },
      );
      // the role landed on the membership (counted) — its permissions resolve
      // through the normal direct ∪ expand(roleIds) path.
      expect(await store.roles.countAssignments(role.id)).toBe(1);
    });
  });

  invitationSeatBlockContract(name, makeStore);
};
