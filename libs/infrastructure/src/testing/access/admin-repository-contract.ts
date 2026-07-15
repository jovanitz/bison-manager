import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type { MembershipId, Role, RoleId, SessionId } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory/access-seed';
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

    it('assigns roles to a membership: counted, resolved, and audited', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const role: Role = {
        id: crypto.randomUUID() as RoleId,
        name: 'Contract role' as Role['name'],
        accountId: null,
        templateKey: null,
        templateSynced: true,
        isPersonal: false,
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

    it('routes a permission edit into a personal role that survives role reassignment (ADR-0014)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const oneOff = accessPresetPermissions('customer');

      await store.admin.updatePermissions(
        ids.membershipSupport,
        oneOff,
        {
          type: 'permissions.updated',
          membershipId: ids.membershipSupport,
          actorMembershipId: ids.membershipSupport,
          before: accessPresetPermissions('support'),
          after: oneOff,
          occurredAt: NOW,
        },
        false,
      );

      // reported back as the member's one-off set (carried by a personal role)
      expect(
        (await store.admin.findMembership(ids.membershipSupport))?.permissions,
      ).toEqual(oneOff);
      // …and surfaced in effective resolution
      const first = await store.actors.findActorBySession(ids.sessionSupport);
      expect(first?.permissions).toEqual(expect.arrayContaining([...oneOff]));

      // assigning a shared role must NOT wipe the personal (one-off) role
      const shared: Role = {
        id: crypto.randomUUID() as RoleId,
        name: 'Shared' as Role['name'],
        accountId: null,
        templateKey: null,
        templateSynced: true,
        isPersonal: false,
        permissions: [
          { action: 'audit.read', scope: 'any' },
        ] as Role['permissions'],
      };
      await store.roles.create(shared);
      await store.admin.assignRoles(ids.membershipSupport, [shared.id], {
        type: 'member.roles-assigned',
        membershipId: ids.membershipSupport,
        actorMembershipId: ids.membershipSupport,
        roleIds: [shared.id],
        occurredAt: NOW,
      });

      // one-off perms preserved; the shared role also resolves
      expect(
        (await store.admin.findMembership(ids.membershipSupport))?.permissions,
      ).toEqual(oneOff);
      const second = await store.actors.findActorBySession(ids.sessionSupport);
      expect(second?.permissions).toEqual(
        expect.arrayContaining([
          ...oneOff,
          { action: 'audit.read', scope: 'any' },
        ]),
      );
      // the personal role is never exposed in the org roles list
      expect(
        (await store.roles.list(ids.acctSupport)).some((r) => r.isPersonal),
      ).toBe(false);
    });
  });
};
