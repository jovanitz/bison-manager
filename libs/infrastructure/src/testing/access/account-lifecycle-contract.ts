import { describe, expect, it } from 'vitest';
import { ACCESS_SESSION_POLICY_DEFAULTS } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../access/in-memory/seed/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  accessContractSeed,
  makeAccessContractIds,
} from './access-store-fixtures';
import type { AccessStorePorts } from './access-store-fixtures';

const CUSTOMER_POLICY = ACCESS_SESSION_POLICY_DEFAULTS.customer;

/**
 * The customer↔staff account-lifecycle contract: demotion STRIPS staff-grade
 * permissions, and the promote→demote round-trip flips customer-directory
 * visibility (the anti-impersonation invariant), for both stores.
 */
export const accountLifecycleContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`AccountLifecycle contract: ${name}`, () => {
    it('demote STRIPS the account’s staff permissions (the security point)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      // acctSupport is a staff account; its member holds support permissions.
      const before = await store.actors.findActorBySession(ids.sessionSupport);
      expect(before?.permissions.length).toBeGreaterThan(0);

      await store.admin.demoteAccountToCustomer(
        ids.acctSupport,
        {
          type: 'account.demoted',
          accountId: ids.acctSupport,
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        },
        CUSTOMER_POLICY,
      );

      expect((await store.admin.findAccount(ids.acctSupport))?.kind).toBe(
        'customer',
      );
      // The staff-grade permissions are GONE — a demoted account keeps none.
      const after = await store.actors.findActorBySession(ids.sessionSupport);
      expect(after?.permissions).toEqual([]);
      expect(
        (await store.auditTrail.list()).map((r) => r.event.type),
      ).toContain('account.demoted');
    });

    it('promote → demote round-trips the customer-directory visibility', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const listed = async () =>
        (await store.customers.search('')).some(
          (c) => c.accountId === ids.acctCustomer,
        );
      expect(await listed()).toBe(true); // starts as a customer

      await store.admin.promoteAccountToStaff(
        ids.acctCustomer,
        {
          type: 'account.promoted',
          accountId: ids.acctCustomer,
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        },
        CUSTOMER_POLICY,
      );
      // Anti-impersonation: a promoted account must LEAVE the customer directory.
      expect(await listed()).toBe(false);

      await store.admin.demoteAccountToCustomer(
        ids.acctCustomer,
        {
          type: 'account.demoted',
          accountId: ids.acctCustomer,
          actorMembershipId: ids.membershipSupport,
          occurredAt: NOW,
        },
        CUSTOMER_POLICY,
      );
      // …and demotion returns it, details intact (kind is the source of truth).
      expect(await listed()).toBe(true);
    });
  });
};
