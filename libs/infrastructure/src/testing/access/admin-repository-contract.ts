import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type {
  AccountId,
  MembershipId,
  Role,
  RoleId,
  SessionId,
} from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory-access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  ACCESS_CONTRACT_SESSION_EXPIRES as EXPIRES,
  accessContractSeed,
  makeAccessContractIds,
} from './access-store-fixtures';
import type { AccessStorePorts } from './access-store-fixtures';

/**
 * Contract for the admin-repository additions: the disable→enable roundtrip
 * (account.enabled audited) and the "active sessions" listing with the
 * context captured at the edge. Invoked from the access-store contract.
 */
export const adminRepositoryContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`AdminRepository contract: ${name}`, () => {
    it('disable → enable roundtrip, both audited', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      await store.admin.disableAccount(ids.acctCustomer, {
        type: 'account.disabled',
        accountId: ids.acctCustomer,
        actorMembershipId: ids.membershipSupport,
        reason: 'review',
        occurredAt: NOW,
      });
      expect((await store.admin.findAccount(ids.acctCustomer))?.status).toBe(
        'disabled',
      );

      await store.admin.enableAccount(ids.acctCustomer, {
        type: 'account.enabled',
        accountId: ids.acctCustomer,
        actorMembershipId: ids.membershipSupport,
        occurredAt: NOW,
      });
      expect((await store.admin.findAccount(ids.acctCustomer))?.status).toBe(
        'active',
      );
      expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
        'account.disabled',
        'account.enabled',
      ]);
    });

    it('lists the sessions of a membership with their captured context', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const membershipId = crypto.randomUUID() as MembershipId;
      await store.onboarding.createOwnerMembership(
        {
          membershipId,
          accountId: crypto.randomUUID() as never,
          userId: ids.userNew,
          email: 'owner@example.com',
          displayName: 'Owner',
          permissions: accessPresetPermissions('owner'),
          occurredAt: NOW,
        },
        {
          type: 'owner.bootstrapped',
          membershipId,
          userId: ids.userNew,
          occurredAt: NOW,
        },
      );
      const sessionId = crypto.randomUUID() as SessionId;
      await store.onboarding.createSession(
        {
          sessionId,
          membershipId,
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

      const sessions = await store.admin.listSessions(membershipId);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        id: sessionId,
        status: 'active',
        userAgent: 'contract-agent',
        createdIp: '203.0.113.7',
        lastIp: '203.0.113.7',
      });
      expect(sessions[0]?.expiresAt).toBe(EXPIRES);

      // an unknown membership simply has no sessions
      expect(
        await store.admin.listSessions(crypto.randomUUID() as MembershipId),
      ).toEqual([]);
    });

    it('refuses to demote the last administrator (anti-orphan), atomically', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const accountId = crypto.randomUUID() as AccountId;
      const adminId = crypto.randomUUID() as MembershipId;
      // owner preset holds permissions.update → the sole administrator
      await store.onboarding.createOwnerMembership(
        {
          membershipId: adminId,
          accountId,
          userId: ids.userNew,
          email: 'admin@example.com',
          displayName: 'Admin',
          permissions: accessPresetPermissions('owner'),
          occurredAt: NOW,
        },
        {
          type: 'owner.bootstrapped',
          membershipId: adminId,
          userId: ids.userNew,
          occurredAt: NOW,
        },
      );

      const event = {
        type: 'permissions.updated' as const,
        membershipId: adminId,
        actorMembershipId: ids.membershipSupport,
        before: accessPresetPermissions('owner'),
        after: accessPresetPermissions('customer'),
        occurredAt: NOW,
      };
      // demoting the only admin is refused; nothing is written
      const blocked = await store.admin.updatePermissions(
        adminId,
        accessPresetPermissions('customer'),
        event,
        true,
      );
      expect(blocked.orphaned).toBe(true);
      expect((await store.admin.findMembership(adminId))?.permissions).toEqual(
        accessPresetPermissions('owner'),
      );

      // a second admin makes the demotion safe
      const secondId = crypto.randomUUID() as MembershipId;
      await store.onboarding.acceptInvitation(
        {
          membershipId: secondId,
          accountId,
          userId: ids.userSupport,
          email: 'admin2@example.com',
          displayName: 'Admin Two',
          permissions: accessPresetPermissions('owner'),
          occurredAt: NOW,
        },
        crypto.randomUUID() as never,
        {
          type: 'invitation.accepted',
          invitationId: crypto.randomUUID() as never,
          accountId,
          membershipId: secondId,
          userId: ids.userSupport,
          occurredAt: NOW,
        },
      );
      const applied = await store.admin.updatePermissions(
        adminId,
        accessPresetPermissions('customer'),
        event,
        true,
      );
      expect(applied.orphaned).toBe(false);
      expect((await store.admin.findMembership(adminId))?.permissions).toEqual(
        accessPresetPermissions('customer'),
      );
    });

    it('assigns roles to a membership: counted, resolved, and audited', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const role: Role = {
        id: crypto.randomUUID() as RoleId,
        name: 'Contract role' as Role['name'],
        accountId: null,
        templateKey: null,
        permissions: [
          { action: 'audit.read', scope: 'any' },
        ] as Role['permissions'],
      };
      await store.roles.create(role);

      await store.admin.assignRoles(ids.membershipSupport, [role.id], {
        type: 'member.roles-assigned',
        membershipId: ids.membershipSupport,
        actorMembershipId: ids.membershipSupport,
        roleIds: [role.id],
        occurredAt: NOW,
      });

      expect(await store.roles.countAssignments(role.id)).toBe(1);
      const actor = await store.actors.findActorBySession(ids.sessionSupport);
      expect(actor?.permissions).toContainEqual({
        action: 'audit.read',
        scope: 'any',
      });
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toContain('member.roles-assigned');
    });
  });
};
