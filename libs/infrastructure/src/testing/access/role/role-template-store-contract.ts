import { describe, expect, it } from 'vitest';
import { makeAccessPermission } from '@acme/domain';
import type { AccessPermission, RoleTemplate } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../../access/in-memory/seed/access-seed';
import {
  accessContractSeed,
  makeAccessContractIds,
} from '../access-store-fixtures';
import type { AccessStorePorts } from '../access-store-fixtures';

const perm = (action: string, scope: 'own' | 'any'): AccessPermission => {
  const made = makeAccessPermission({ action, scope });
  if (!made.ok) throw new Error('setup: invalid permission');
  return made.value;
};

const template = (overrides: Partial<RoleTemplate> = {}): RoleTemplate => ({
  key: 'support',
  scope: 'platform',
  name: 'Support',
  permissions: [perm('staff.read', 'any')],
  ...overrides,
});

/**
 * Contract for the default-role template store (ADR-0013/0014). It holds only
 * staff *overrides* — an empty store is the steady state (code is the floor,
 * merged in the use case). `upsert` is insert-or-replace on the template key.
 */
export const roleTemplateStoreContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`RoleTemplateStore contract: ${name}`, () => {
    it('starts empty — no overrides until a staff edit', async () => {
      const store = await makeStore(
        accessContractSeed(makeAccessContractIds()),
      );
      expect(await store.roleTemplates.list()).toEqual([]);
      expect(await store.roleTemplates.findByKey('support')).toBeNull();
    });

    it('upserts an override and reads it back by key and in the list', async () => {
      const store = await makeStore(
        accessContractSeed(makeAccessContractIds()),
      );
      const edited = template({ name: 'Support (edited)' });
      await store.roleTemplates.upsert(edited);

      expect(await store.roleTemplates.findByKey('support')).toEqual(edited);
      expect(await store.roleTemplates.list()).toEqual([edited]);
    });

    it('replaces an existing override on a second upsert (same key)', async () => {
      const store = await makeStore(
        accessContractSeed(makeAccessContractIds()),
      );
      await store.roleTemplates.upsert(template({ name: 'First' }));
      await store.roleTemplates.upsert(
        template({ name: 'Second', permissions: [perm('audit.read', 'any')] }),
      );

      const reread = await store.roleTemplates.findByKey('support');
      expect(reread?.name).toBe('Second');
      expect(reread?.permissions).toEqual([perm('audit.read', 'any')]);
      expect(await store.roleTemplates.list()).toHaveLength(1);
    });
  });
};
