import { describe, expect, it } from 'vitest';
import type { AccessPermission } from '../permission';
import type { AccountId, RoleId } from '../value-objects';
import { ROLE_NAME_MAX_LENGTH, createRole, makeRoleName } from './role';

const PERMS: ReadonlyArray<AccessPermission> = [
  { action: 'members.invite', scope: 'own' } as AccessPermission,
];

describe('makeRoleName', () => {
  it('accepts and trims a non-empty name', () => {
    const name = makeRoleName('  Org Admin  ');
    expect(name.ok && name.value).toBe('Org Admin');
  });

  it('rejects an empty / whitespace name', () => {
    expect(makeRoleName('   ').ok).toBe(false);
  });

  it('rejects a name over the max length', () => {
    expect(makeRoleName('x'.repeat(ROLE_NAME_MAX_LENGTH + 1)).ok).toBe(false);
  });
});

describe('createRole', () => {
  it('builds a valid role (platform or account-scoped)', () => {
    const role = createRole({
      id: 'role-1' as RoleId,
      name: 'Support',
      accountId: null,
      permissions: PERMS,
    });
    expect(role.ok).toBe(true);
    if (role.ok) {
      expect(role.value.name).toBe('Support');
      expect(role.value.accountId).toBeNull();
      expect(role.value.permissions).toEqual(PERMS);
    }
  });

  it('fails when the name is invalid', () => {
    const role = createRole({
      id: 'role-1' as RoleId,
      name: '',
      accountId: 'acct-1' as AccountId,
      permissions: PERMS,
    });
    expect(role.ok).toBe(false);
    if (!role.ok) expect(role.error.tag).toBe('domain/invalid-role-name');
  });
});
