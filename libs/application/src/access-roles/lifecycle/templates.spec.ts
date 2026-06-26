import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { Role, RoleId, RoleTemplate } from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../../access/testing';
import type { RoleStore, RoleTemplateStore } from '../ports';
import {
  makeApplyTemplateToAll,
  makeListTemplates,
  makeResetTemplate,
  makeUpdateTemplate,
} from './templates';

const role = (
  id: string,
  templateKey: string,
  templateSynced: boolean,
): Role => ({
  id: id as RoleId,
  name: id as Role['name'],
  accountId: null,
  permissions: [{ action: 'staff.read', scope: 'any' }] as Role['permissions'],
  templateKey,
  templateSynced,
  isPersonal: false,
});

const makeWorld = (input?: {
  templates?: ReadonlyArray<RoleTemplate>;
  roles?: ReadonlyArray<Role>;
}) => {
  const templateStore = new Map(
    (input?.templates ?? []).map((t) => [t.key, t]),
  );
  const roleStore = new Map(
    (input?.roles ?? []).map((r) => [r.id as string, r]),
  );
  const templates: RoleTemplateStore = {
    list: async () => [...templateStore.values()],
    findByKey: async (key) => templateStore.get(key) ?? null,
    upsert: async (t) => {
      templateStore.set(t.key, t);
    },
  };
  const roles: Pick<RoleStore, 'syncTemplate'> = {
    syncTemplate: async (templateKey, patch, options) => {
      let updated = 0;
      for (const r of roleStore.values()) {
        if (r.templateKey !== templateKey) continue;
        if (!options.includeForked && !r.templateSynced) continue;
        roleStore.set(r.id, {
          ...r,
          name: patch.name as Role['name'],
          permissions: patch.permissions,
          templateSynced: true,
        });
        updated += 1;
      }
      return updated;
    },
  };
  const deps = {
    templates,
    roles,
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
  };
  return { deps, templateStore, roleStore };
};

const owner = testAccessActor({ preset: 'owner' });

describe('default templates (ADR-0013)', () => {
  it('lists the full code catalogue with staff edits applied over it', async () => {
    const world = makeWorld();
    const pristine = await makeListTemplates(world.deps)({ actor: owner });
    expect(pristine.ok && pristine.value.length).toBeGreaterThan(0);

    await makeUpdateTemplate(world.deps)({
      actor: owner,
      key: 'support',
      name: 'Support (edited)',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    const edited = await makeListTemplates(world.deps)({ actor: owner });
    const support = edited.ok && edited.value.find((t) => t.key === 'support');
    expect(support && support.name).toBe('Support (edited)');
  });

  it('denies editing a template without permissions.update', async () => {
    const result = await makeUpdateTemplate(makeWorld().deps)({
      actor: testAccessActor({ preset: 'customer' }),
      key: 'support',
      name: 'Hijacked',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
  });

  it('rejects an unknown template key', async () => {
    const result = await makeUpdateTemplate(makeWorld().deps)({
      actor: owner,
      key: 'does-not-exist',
      name: 'Nope',
      permissions: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/role-not-found');
  });

  it('resets an edited template back to its code definition', async () => {
    const world = makeWorld();
    await makeUpdateTemplate(world.deps)({
      actor: owner,
      key: 'support',
      name: 'Drifted',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    const reset = await makeResetTemplate(world.deps)({
      actor: owner,
      key: 'support',
    });
    expect(reset.ok).toBe(true);
    expect(world.templateStore.get('support')?.name).not.toBe('Drifted');
  });

  it('propagates an edit to synced instances but leaves forks alone (ADR-0014)', async () => {
    const world = makeWorld({
      roles: [
        role('inst-synced', 'support', true),
        role('inst-forked', 'support', false),
      ],
    });
    await makeUpdateTemplate(world.deps)({
      actor: owner,
      key: 'support',
      name: 'Support v2',
      permissions: [{ action: 'audit.read', scope: 'any' }],
    });
    expect(world.roleStore.get('inst-synced')?.permissions).toEqual([
      { action: 'audit.read', scope: 'any' },
    ]);
    expect(world.roleStore.get('inst-forked')?.permissions).toEqual([
      { action: 'staff.read', scope: 'any' },
    ]);
  });

  it('applyTemplateToAll forces forked instances back and re-syncs them', async () => {
    const world = makeWorld({ roles: [role('inst-forked', 'support', false)] });
    await makeUpdateTemplate(world.deps)({
      actor: owner,
      key: 'support',
      name: 'Support v2',
      permissions: [{ action: 'audit.read', scope: 'any' }],
    });
    const applied = await makeApplyTemplateToAll(world.deps)({
      actor: owner,
      key: 'support',
    });
    expect(applied.ok && applied.value.updated).toBe(1);
    expect(world.roleStore.get('inst-forked')?.permissions).toEqual([
      { action: 'audit.read', scope: 'any' },
    ]);
    expect(world.roleStore.get('inst-forked')?.templateSynced).toBe(true);
  });

  it('denies applyTemplateToAll without permissions.update', async () => {
    const result = await makeApplyTemplateToAll(makeWorld().deps)({
      actor: testAccessActor({ preset: 'customer' }),
      key: 'support',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
  });
});
