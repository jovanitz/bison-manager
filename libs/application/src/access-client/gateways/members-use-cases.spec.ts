import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { accessDenied } from '../../access/errors';
import { accessGatewayError } from '../errors';
import { makeMembersUseCases } from './members-use-cases';
import type { MembersGateway, MemberSummaryDto } from '../ports';

const MEMBERS: ReadonlyArray<MemberSummaryDto> = [
  {
    membershipId: 'm-1',
    userId: 'u-1',
    permissions: [],
    isRoot: false,
    blocked: false,
  },
];

const gateway = (overrides: Partial<MembersGateway> = {}): MembersGateway => ({
  listMembers: async () => ok(MEMBERS),
  updatePermissions: async () => ok(undefined),
  removeMember: async () => ok(undefined),
  setMemberBlocked: async () => ok(undefined),
  ...overrides,
});

describe('makeMembersUseCases', () => {
  it('forwards listMembers, updatePermissions and removeMember', async () => {
    const useCases = makeMembersUseCases({ gateway: gateway() });
    const listed = await useCases.listMembers('acct-1');
    expect(listed.ok && listed.value).toEqual(MEMBERS);
    const updated = await useCases.updatePermissions({
      membershipId: 'm-1',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    expect(updated.ok).toBe(true);
    const removed = await useCases.removeMember({ membershipId: 'm-1' });
    expect(removed.ok).toBe(true);
  });

  it('propagates a list failure and an update failure', async () => {
    const useCases = makeMembersUseCases({
      gateway: gateway({
        listMembers: async () => err(accessGatewayError('down')),
        updatePermissions: async () => err(accessDenied('nope')),
      }),
    });
    const listed = await useCases.listMembers('acct-1');
    expect(listed.ok).toBe(false);
    const updated = await useCases.updatePermissions({
      membershipId: 'm-root',
      permissions: [],
    });
    expect(updated.ok).toBe(false);
    if (!updated.ok) expect(updated.error.tag).toBe('app/access-denied');
  });
});
