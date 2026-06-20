import { describe, expect, it } from 'vitest';
import type { AccountId, RoleId } from '../value-objects';
import { createRole } from './role';
import {
  ROLE_TEMPLATES,
  findRoleTemplate,
  resetRoleFromTemplate,
  roleTemplatesForScope,
} from './templates';

describe('role templates (ADR-0012)', () => {
  it('catalogues unique keys', () => {
    const keys = ROLE_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('finds by key and filters by scope', () => {
    expect(findRoleTemplate('support')?.scope).toBe('platform');
    expect(findRoleTemplate('nope')).toBeNull();
    expect(roleTemplatesForScope('org').every((t) => t.scope === 'org')).toBe(
      true,
    );
  });

  it('resets a role to its template, keeping id + account', () => {
    const built = createRole({
      id: 'r-1' as RoleId,
      name: 'Renamed by hand',
      accountId: 'acct-1' as AccountId,
      permissions: [],
      templateKey: 'admin',
    });
    if (!built.ok) throw new Error('setup');
    const template = findRoleTemplate('admin');
    if (!template) throw new Error('setup');

    const reset = resetRoleFromTemplate(built.value, template);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.value.id).toBe('r-1'); // identity preserved
    expect(reset.value.accountId).toBe('acct-1');
    expect(reset.value.name).toBe('Admin'); // name restored
    expect(reset.value.permissions).toEqual(template.permissions);
    expect(reset.value.templateKey).toBe('admin');
  });
});
