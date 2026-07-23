import { describe, expect, it } from 'vitest';
import type {
  RoleSummaryDto,
  RoleTemplateDto,
  RolesViewModel,
  TemplatesViewModel,
} from '@acme/application';
import {
  blankRole,
  draftFromRoleRow,
  toRoleRow,
  toRolesVM,
  toTemplateRow,
  toTemplatesVM,
} from './roles-vm';

const customRole: RoleSummaryDto = {
  id: 'r_support',
  name: 'Support',
  accountId: null,
  permissions: [
    { action: 'staff.read', scope: 'any' },
    { action: 'audit.read', scope: 'any' },
  ],
  templateKey: null, // a custom role — not from a template
  templateSynced: true,
};

const forkedDefault: RoleSummaryDto = {
  ...customRole,
  id: 'r_admin',
  name: 'Admin',
  templateKey: 'org-admin', // a default role…
  templateSynced: false, // …edited away from its template (forked)
};

describe('toRoleRow', () => {
  it('derives isDefault from templateKey and synced from templateSynced', () => {
    expect(toRoleRow(customRole).isDefault).toBe(false); // templateKey null
    const admin = toRoleRow(forkedDefault);
    expect(admin.isDefault).toBe(true); // templateKey present
    expect(admin.synced).toBe(false); // forked
  });

  it('carries the permission pairs through', () => {
    expect(toRoleRow(customRole).permissions).toEqual([
      { action: 'staff.read', scope: 'any' },
      { action: 'audit.read', scope: 'any' },
    ]);
  });
});

describe('toRolesVM', () => {
  it('maps the roles and passes canManage through, not loading', () => {
    const rm: RolesViewModel = { roles: [customRole], canManage: true };
    const vm = toRolesVM(rm);
    expect(vm.loading).toBe(false);
    expect(vm.canManage).toBe(true);
    expect(vm.roles[0]?.id).toBe('r_support');
  });
});

describe('templates', () => {
  const platformTpl: RoleTemplateDto = {
    key: 'staff-support',
    scope: 'platform',
    name: 'Support',
    permissions: [{ action: 'staff.read', scope: 'any' }],
  };
  const orgTpl: RoleTemplateDto = {
    ...platformTpl,
    key: 'org-admin',
    scope: 'org',
    name: 'Admin',
  };

  it('toTemplateRow narrows scope to platform | org', () => {
    expect(toTemplateRow(platformTpl).scope).toBe('platform');
    expect(toTemplateRow(orgTpl).scope).toBe('org');
  });

  it('toTemplatesVM maps + passes canManage', () => {
    const rm: TemplatesViewModel = { templates: [orgTpl], canManage: false };
    const vm = toTemplatesVM(rm);
    expect(vm.canManage).toBe(false);
    expect(vm.templates[0]?.name).toBe('Admin');
  });
});

describe('drafts', () => {
  it('blankRole opens with one empty permission row', () => {
    expect(blankRole.name).toBe('');
    expect(blankRole.permissions).toEqual([{ action: '', scope: 'any' }]);
  });

  it('draftFromRoleRow round-trips name + permissions', () => {
    const draft = draftFromRoleRow(toRoleRow(customRole));
    expect(draft.name).toBe('Support');
    expect(draft.permissions).toHaveLength(2);
  });
});
