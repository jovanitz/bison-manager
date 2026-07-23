import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { RoleTemplateDto } from '@acme/application';
import {
  createTemplatesStore,
  type TemplatesStoreDeps,
} from './templates-store';

const tplDto: RoleTemplateDto = {
  key: 'org-admin',
  scope: 'org',
  name: 'Admin',
  permissions: [{ action: 'members.read', scope: 'own' }],
};

const snapshot = {
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [{ action: 'permissions.update', scope: 'any' }],
  activeGrants: [],
};

const makeDeps = (over: Record<string, unknown> = {}) =>
  ({
    access: { currentAccess: async () => ok(snapshot) },
    roles: {
      listTemplates: async () => ok([tplDto]),
      updateTemplate: async () => ok(undefined),
      resetTemplate: async () => ok(undefined),
      applyTemplateToAll: async () => ok({ updated: 8 }),
      ...over,
    },
  }) as unknown as TemplatesStoreDeps;

describe('createTemplatesStore', () => {
  it('load maps the templates + canManage', async () => {
    const store = createTemplatesStore(makeDeps());
    await store.getState().load();
    expect(store.getState().vm.canManage).toBe(true);
    expect(store.getState().vm.templates[0]?.key).toBe('org-admin');
  });

  it('edit dispatches updateTemplate at the key', async () => {
    const updateTemplate = vi.fn(async () => ok(undefined));
    const store = createTemplatesStore(makeDeps({ updateTemplate }));
    await store.getState().load();
    store.getState().openEdit('org-admin');
    const draft = store.getState().vm.form?.draft;
    await store.getState().submitForm({ ...draft!, name: 'Admin+' });
    expect(updateTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'org-admin', name: 'Admin+' }),
    );
  });

  it('reset dispatches resetTemplate', async () => {
    const resetTemplate = vi.fn(async () => ok(undefined));
    const store = createTemplatesStore(makeDeps({ resetTemplate }));
    await store.getState().load();
    store.getState().openReset('org-admin');
    await store.getState().confirmReset();
    expect(resetTemplate).toHaveBeenCalledWith('org-admin');
  });

  it('apply-to-all surfaces the {updated} count as a notice', async () => {
    const applyTemplateToAll = vi.fn(async () => ok({ updated: 8 }));
    const store = createTemplatesStore(makeDeps({ applyTemplateToAll }));
    await store.getState().load();
    store.getState().openApply('org-admin');
    await store.getState().confirmApply();
    expect(applyTemplateToAll).toHaveBeenCalledWith('org-admin');
    expect(store.getState().vm.pendingApply).toBeUndefined();
    expect(store.getState().vm.notice).toContain('8 live roles');
  });
});
