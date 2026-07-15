import { describe, expect, it } from 'vitest';
import { createRole, makeAccessPermission } from '@acme/domain';
import type { AccessPermission, AccountId, Role, RoleId } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../../access/in-memory/access-seed';
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

const buildRole = (input: {
  readonly accountId: AccountId | null;
  readonly name: string;
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly templateKey?: string | null;
  readonly templateSynced?: boolean;
  readonly isPersonal?: boolean;
}): Role => {
  const role = createRole({ id: crypto.randomUUID() as RoleId, ...input });
  if (!role.ok) throw new Error('setup: invalid role');
  return role.value;
};

/**
 * Contract for the dynamic-role store (ADR-0011). `list` is scoped (platform
 * roles plus the asked account's own), `findManyById` is the expansion read,
 * `countAssignments` backs the delete-blocked-in-use guard. Assigning a role to
 * a membership is a later phase, so the >0 assignment count is exercised by the
 * use-case spec, not here.
 */
export const roleStoreContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`RoleStore contract: ${name}`, () => {
    it('creates, reads back, and scopes list to platform + account', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const platform = buildRole({
        accountId: null,
        name: 'Platform support',
        permissions: [perm('staff.read', 'any')],
      });
      const orgRole = buildRole({
        accountId: ids.acctCustomer,
        name: 'Org viewer',
        permissions: [perm('members.read', 'own')],
      });
      await store.roles.create(platform);
      await store.roles.create(orgRole);

      expect(await store.roles.findById(platform.id)).toEqual(platform);
      expect(
        (await store.roles.list(ids.acctCustomer)).map((r) => r.id).sort(),
      ).toEqual([platform.id, orgRole.id].sort());
      // a different account sees only platform roles, never another org's
      expect(
        (await store.roles.list(ids.acctSupport)).map((r) => r.id),
      ).toEqual([platform.id]);
      // platform-only view (accountId null)
      expect((await store.roles.list(null)).map((r) => r.id)).toEqual([
        platform.id,
      ]);
    });

    it('round-trips the template provenance (ADR-0012)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const fromTemplate = buildRole({
        accountId: ids.acctCustomer,
        name: 'Admin',
        permissions: [perm('members.read', 'own')],
        templateKey: 'admin',
      });
      const custom = buildRole({
        accountId: ids.acctCustomer,
        name: 'Bespoke',
        permissions: [perm('members.read', 'own')],
      });
      await store.roles.create(fromTemplate);
      await store.roles.create(custom);

      expect((await store.roles.findById(fromTemplate.id))?.templateKey).toBe(
        'admin',
      );
      expect((await store.roles.findById(custom.id))?.templateKey).toBeNull();
      // a fresh instance starts synced to its template (ADR-0014)
      const inst = await store.roles.findById(fromTemplate.id);
      expect(inst?.templateSynced).toBe(true);
      expect(inst?.isPersonal).toBe(false);
    });

    it('syncTemplate propagates to synced instances, optionally forks too (ADR-0014)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const synced = buildRole({
        accountId: ids.acctCustomer,
        name: 'Admin',
        permissions: [perm('members.read', 'own')],
        templateKey: 'admin',
      });
      const forked = buildRole({
        accountId: null,
        name: 'Admin fork',
        permissions: [perm('members.read', 'own')],
        templateKey: 'admin',
        templateSynced: false,
      });
      await store.roles.create(synced);
      await store.roles.create(forked);

      // a normal staff edit touches only instances still synced
      const touched = await store.roles.syncTemplate(
        'admin',
        { name: 'Admin v2', permissions: [perm('audit.read', 'any')] },
        { includeForked: false },
      );
      expect(touched).toBe(1);
      expect((await store.roles.findById(synced.id))?.name).toBe('Admin v2');
      const stillForked = await store.roles.findById(forked.id);
      expect(stillForked?.name).toBe('Admin fork'); // untouched
      expect(stillForked?.templateSynced).toBe(false);

      // apply-to-all forces the fork back and re-syncs it
      const all = await store.roles.syncTemplate(
        'admin',
        { name: 'Admin v3', permissions: [perm('audit.read', 'any')] },
        { includeForked: true },
      );
      expect(all).toBe(2);
      const resynced = await store.roles.findById(forked.id);
      expect(resynced?.name).toBe('Admin v3');
      expect(resynced?.templateSynced).toBe(true);
    });

    it('resolves a membership’s role ids via findManyById, ignoring misses', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const a = buildRole({
        accountId: null,
        name: 'A',
        permissions: [perm('staff.read', 'any')],
      });
      const b = buildRole({
        accountId: null,
        name: 'B',
        permissions: [perm('audit.read', 'any')],
      });
      await store.roles.create(a);
      await store.roles.create(b);

      const found = await store.roles.findManyById([
        a.id,
        crypto.randomUUID() as RoleId,
        b.id,
      ]);
      expect(found.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
      expect(await store.roles.findManyById([])).toEqual([]);
    });

    it('updates name + permissions, false for an unknown id', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const role = buildRole({
        accountId: null,
        name: 'Before',
        permissions: [perm('staff.read', 'any')],
      });
      await store.roles.create(role);

      expect(
        await store.roles.update(role.id, {
          name: 'After',
          permissions: [perm('audit.read', 'any')],
        }),
      ).toBe(true);
      const reread = await store.roles.findById(role.id);
      expect(reread?.name).toBe('After');
      expect(reread?.permissions).toEqual([perm('audit.read', 'any')]);
      expect(
        await store.roles.update(crypto.randomUUID() as RoleId, {
          name: 'nope',
          permissions: [],
        }),
      ).toBe(false);
    });

    it('counts zero assignments for a fresh role and removes it', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const role = buildRole({
        accountId: null,
        name: 'Disposable',
        permissions: [perm('staff.read', 'any')],
      });
      await store.roles.create(role);

      expect(await store.roles.countAssignments(role.id)).toBe(0);
      await store.roles.remove(role.id);
      expect(await store.roles.findById(role.id)).toBeNull();
    });

    // ADR-0011 actor resolution: a membership's effective permissions are its
    // direct ones unioned with everything its roles expand to, and the
    // ownership flag surfaces on the actor.
    it('resolves actor permissions as direct ∪ roles and surfaces isAccountOwner', async () => {
      const ids = makeAccessContractIds();
      const role = buildRole({
        accountId: null,
        name: 'Auditor',
        permissions: [perm('audit.read', 'any'), perm('staff.read', 'any')],
      });
      const store = await makeStore({
        ...accessContractSeed(ids),
        roles: [role],
        memberships: [
          {
            id: ids.membershipSupport,
            userId: ids.userSupport,
            accountId: ids.acctSupport,
            permissions: [perm('staff.read', 'any')],
            roleIds: [role.id],
            isAccountOwner: true,
          },
        ],
      });

      const actor = await store.actors.findActorBySession(ids.sessionSupport);
      expect(actor?.isAccountOwner).toBe(true);
      // direct staff.read unioned with the role's audit.read; staff.read de-duped
      expect(
        actor?.permissions.map((p) => `${p.action}:${p.scope}`).sort(),
      ).toEqual(['audit.read:any', 'staff.read:any']);
    });
  });
};
