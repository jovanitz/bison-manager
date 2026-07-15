import { describe, expect, it } from 'vitest';
import type { InMemoryAccessSeed } from '../../access/in-memory/seed/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  accessContractSeed,
  makeAccessContractIds,
} from './access-store-fixtures';
import type { AccessStorePorts } from './access-store-fixtures';

/** The audit-trail read filters (type / account / limit), for both stores. */
export const auditTrailContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`AuditTrail contract: ${name}`, () => {
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
};
