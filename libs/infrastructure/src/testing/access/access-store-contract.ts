import { describe, expect, it } from 'vitest';
import { accessPresetPermissions, recordAccessGrantExpiry } from '@acme/domain';
import type {
  AccessGrant,
  AccountId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import { SEED_SESSION_CREATED_AT } from '../../access/in-memory/access-seed';
import type { InMemoryAccessSeed } from '../../access/in-memory/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  ACCESS_CONTRACT_SESSION_EXPIRES as SESSION_EXPIRES,
  accessContractGrant,
  accessContractSeed,
  makeAccessContractIds,
} from './access-store-fixtures';
import type { AccessStorePorts } from './access-store-fixtures';
import { adminRepositoryContract } from './admin-repository-contract';
import { adminAntiOrphanContract } from './admin-anti-orphan-contract';
import { memberDirectoryContract } from './member-directory-contract';
import { roleContracts } from './role/contracts';
/** Contract every access store (in-memory, Postgres) must satisfy identically; `makeStore` must return exactly the given seed (DBs isolate per call). */
export const accessStoreContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`AccessStore contract: ${name}`, () => {
    it('derives the actor by joining session → membership → account → grants', async () => {
      const ids = makeAccessContractIds();
      const grant = accessContractGrant(
        ids,
        '2026-06-09T12:40:00.000Z',
        '2026-06-09T13:00:00.000Z',
      );
      const store = await makeStore({
        ...accessContractSeed(ids),
        grants: [grant],
      });

      const actor = await store.actors.findActorBySession(ids.sessionSupport);

      expect(actor?.membership.id).toBe(ids.membershipSupport);
      expect(actor?.membership.accountId).toBe(ids.acctSupport);
      expect(actor?.accountStatus).toBe('active');
      expect(actor?.accountKind).toBe('staff');
      expect(actor?.session.status).toBe('active');
      expect(actor?.session.expiresAt).toBe(SESSION_EXPIRES);
      expect(actor?.session.createdAt).toBe(SEED_SESSION_CREATED_AT);
      expect(actor?.permissions).toEqual(accessPresetPermissions('support'));
      expect(actor?.grants).toEqual([grant]);
      expect(
        await store.actors.findActorBySession('session-x' as SessionId),
      ).toBeNull();
    });

    it('makes admin mutations visible on the next actor read, with their audit events', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      await store.admin.disableAccount(ids.acctSupport, {
        type: 'account.disabled',
        accountId: ids.acctSupport,
        actorMembershipId: ids.membershipSupport,
        reason: null,
        occurredAt: NOW,
      });
      await store.admin.revokeSession(ids.sessionSupport, {
        type: 'session.revoked',
        sessionId: ids.sessionSupport,
        actorMembershipId: ids.membershipSupport,
        occurredAt: NOW,
      });
      await store.admin.updatePermissions(
        ids.membershipSupport,
        [],
        {
          type: 'permissions.updated',
          membershipId: ids.membershipSupport,
          actorMembershipId: ids.membershipSupport,
          before: accessPresetPermissions('support'),
          after: [],
          occurredAt: NOW,
        },
        false,
      );
      const actor = await store.actors.findActorBySession(ids.sessionSupport);
      expect(actor?.accountStatus).toBe('disabled');
      expect(actor?.session.status).toBe('revoked');
      expect(actor?.permissions).toEqual([]);
      expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
        'account.disabled',
        'session.revoked',
        'permissions.updated',
      ]);
    });

    it('reads back admin snapshots and misses unknown ids as null', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      expect(await store.admin.findAccount(ids.acctSupport)).toEqual({
        id: ids.acctSupport,
        status: 'active',
        kind: 'staff',
        hostsRoot: false,
      });
      expect(await store.admin.findMembership(ids.membershipSupport)).toEqual({
        id: ids.membershipSupport,
        accountId: ids.acctSupport,
        accountKind: 'staff',
        permissions: accessPresetPermissions('support'),
        isRoot: false,
        isAccountOwner: false,
      });
      expect(await store.admin.findSession(ids.sessionSupport)).toEqual({
        id: ids.sessionSupport,
        accountId: ids.acctSupport,
        status: 'active',
        isRoot: false,
      });
      expect(await store.admin.findAccount('nope' as AccountId)).toBeNull();
      expect(
        await store.admin.findMembership('nope' as MembershipId),
      ).toBeNull();
      expect(await store.admin.findSession('nope' as SessionId)).toBeNull();
      expect(
        await store.grants.findById('nope' as AccessGrant['id']),
      ).toBeNull();
    });

    it('persists grants and lazy expiry together with their audit events', async () => {
      const ids = makeAccessContractIds();
      const grant = accessContractGrant(
        ids,
        '2026-06-09T10:00:00.000Z',
        '2026-06-09T10:30:00.000Z',
      );
      const store = await makeStore(accessContractSeed(ids));

      await store.grants.saveNew(grant, {
        type: 'impersonation.started',
        grantId: grant.id,
        actorMembershipId: grant.membershipId,
        targetAccountId: grant.targetAccountId,
        reason: grant.reason,
        actions: grant.actions,
        expiresAt: grant.expiresAt,
        occurredAt: grant.createdAt,
      });
      expect(await store.grants.findById(grant.id)).toEqual(grant);

      const recorded = recordAccessGrantExpiry(grant, NOW);
      if (!recorded.ok) throw new Error('setup');
      await store.grantExpiry.recordExpiry([recorded.value]);

      expect((await store.grants.findById(grant.id))?.expiryRecordedAt).toBe(
        NOW,
      );
      const types = (await store.auditTrail.list()).map((r) => r.event.type);
      expect(types).toEqual(['impersonation.started', 'grant.expired']);
    });

    it('ends an impersonation grant via saveEnded', async () => {
      const ids = makeAccessContractIds();
      const grant = accessContractGrant(ids, NOW, '2026-06-09T12:30:00.000Z');
      const store = await makeStore(accessContractSeed(ids));
      await store.grants.saveNew(grant, {
        type: 'impersonation.started',
        grantId: grant.id,
        actorMembershipId: grant.membershipId,
        targetAccountId: grant.targetAccountId,
        reason: grant.reason,
        actions: grant.actions,
        expiresAt: grant.expiresAt,
        occurredAt: grant.createdAt,
      });

      const ended: AccessGrant = { ...grant, revokedAt: NOW };
      await store.grants.saveEnded(ended, {
        type: 'impersonation.ended',
        grantId: grant.id,
        actorMembershipId: grant.membershipId,
        targetAccountId: grant.targetAccountId,
        occurredAt: NOW,
      });

      expect((await store.grants.findById(grant.id))?.revokedAt).toBe(NOW);
      expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
        'impersonation.started',
        'impersonation.ended',
      ]);
    });

    it('searches and reads only customer accounts', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));

      expect(await store.customers.search('casa')).toEqual([
        {
          accountId: ids.acctCustomer,
          displayName: 'Casa Pampa',
          email: 'ops@casapampa.example',
        },
      ]);
      expect(await store.customers.search('nadie')).toEqual([]);
      expect(await store.customers.read(ids.acctCustomer)).toMatchObject({
        displayName: 'Casa Pampa',
        status: 'active',
      });
      expect(await store.customers.read(ids.acctSupport)).toBeNull();
    });

    it('filters the audit trail by type, account and limit', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      await store.auditTrail.append({
        type: 'login.failed',
        attemptedIdentifier: 'mallory@example.com',
        occurredAt: NOW,
      });
      await store.auditTrail.append({
        type: 'account.disabled',
        accountId: ids.acctCustomer,
        actorMembershipId: ids.membershipSupport,
        reason: null,
        occurredAt: NOW,
      });

      const byType = await store.auditTrail.list({
        types: ['account.disabled'],
      });
      expect(byType).toHaveLength(1);
      const byAccount = await store.auditTrail.list({
        accountId: ids.acctCustomer,
      });
      expect(byAccount).toHaveLength(1);
      expect(byAccount[0]?.event.type).toBe('account.disabled');
      const limited = await store.auditTrail.list({ limit: 1 });
      expect(limited).toHaveLength(1);
      expect(limited[0]?.event.type).toBe('login.failed');
    });
  });

  adminRepositoryContract(name, makeStore);
  adminAntiOrphanContract(name, makeStore);
  memberDirectoryContract(name, makeStore);
  roleContracts(name, makeStore);
};
