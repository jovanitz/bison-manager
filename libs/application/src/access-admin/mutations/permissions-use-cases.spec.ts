import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type { AccountId, MembershipId } from '@acme/domain';
import { testAccessActor } from '../../access/testing';
import { inMemoryAdmin, testAdminDeps } from '../testing';
import type { AdminMembershipSnapshot } from '../ports';
import { makeUpdateUserPermissions } from './permissions-use-cases';

const member = (
  input: Partial<AdminMembershipSnapshot> & { id: string },
): AdminMembershipSnapshot => ({
  id: input.id as MembershipId,
  accountId: (input.accountId ?? 'acct-1') as AccountId,
  accountKind: 'staff',
  permissions: input.permissions ?? [],
  isRoot: input.isRoot ?? false,
});

const ROOT = member({
  id: 'm-root',
  permissions: accessPresetPermissions('owner'),
  isRoot: true,
});
const PLAIN = member({ id: 'm-plain' });

const STAFF_READ = [{ action: 'staff.read', scope: 'any' }];

describe('makeUpdateUserPermissions', () => {
  it('adds permissions to a normal member', async () => {
    const admin = inMemoryAdmin({ memberships: [ROOT, PLAIN] });
    const update = makeUpdateUserPermissions(testAdminDeps(admin));

    const r = await update({
      actor: testAccessActor({ preset: 'owner', membershipId: 'm-admin' }),
      membershipId: 'm-plain',
      permissions: STAFF_READ,
    });

    expect(r.ok).toBe(true);
    expect(
      admin.memberships.get('m-plain' as MembershipId)?.permissions,
    ).toEqual(STAFF_READ);
  });

  it('refuses a NON-root actor changing the super-admin — even with full owner permissions', async () => {
    const admin = inMemoryAdmin({ memberships: [ROOT, PLAIN] });
    const update = makeUpdateUserPermissions(testAdminDeps(admin));

    const r = await update({
      // same permission set as the owner, but not the root itself
      actor: testAccessActor({
        preset: 'owner',
        membershipId: 'm-attacker',
        isRoot: false,
      }),
      membershipId: 'm-root',
      permissions: STAFF_READ,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    // untouched
    expect(
      admin.memberships.get('m-root' as MembershipId)?.permissions,
    ).toEqual(accessPresetPermissions('owner'));
  });

  it('lets the root itself edit the root', async () => {
    const admin = inMemoryAdmin({ memberships: [ROOT] });
    const update = makeUpdateUserPermissions(testAdminDeps(admin));

    const r = await update({
      actor: testAccessActor({
        preset: 'owner',
        membershipId: 'm-root',
        isRoot: true,
      }),
      membershipId: 'm-root',
      permissions: accessPresetPermissions('owner'),
    });

    expect(r.ok).toBe(true);
  });
});
