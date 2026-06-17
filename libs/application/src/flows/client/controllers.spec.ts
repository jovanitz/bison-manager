import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type {
  MemberSummaryDto,
  MyMembershipDto,
} from '../../access-client/ports';
import { grantMemberPermission, loadOrgAdmin } from './org-admin';
import { loadHome } from './home';
import { resolveClientGate } from './gate';
import type { ClientFlowDeps } from './registry';

const access = (over: Partial<CurrentAccessDto> = {}): CurrentAccessDto => ({
  membershipId: 'mem-1',
  userId: 'u@x.test',
  accountId: 'acct-1',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's-1', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [{ action: 'members.read', scope: 'own' }],
  activeGrants: [],
  ...over,
});

const MEMBERS: ReadonlyArray<MemberSummaryDto> = [
  {
    membershipId: 'm-1',
    userId: 'a@x.test',
    permissions: [{ action: 'customer.read', scope: 'own' }],
    isRoot: false,
    blocked: false,
  },
];

const MINE: ReadonlyArray<MyMembershipDto> = [
  {
    membershipId: 'mem-1',
    accountId: 'acct-1',
    accountKind: 'customer',
    accountStatus: 'active',
    accountName: 'Mine',
  },
];

const deps = (over: Partial<ClientFlowDeps> = {}): ClientFlowDeps =>
  ({
    access: {
      getSession: async () => ok({}),
      currentAccess: async () => ok(access()),
    },
    members: {
      listMembers: async () => ok(MEMBERS),
      updatePermissions: async () => ok(undefined),
      removeMember: async () => ok(undefined),
      setMemberBlocked: async () => ok(undefined),
    },
    invitations: { invite: async () => ok({ invitationId: 'i', token: 't' }) },
    orgs: { listMyMemberships: async () => ok(MINE) },
    ...over,
  }) as unknown as ClientFlowDeps;

describe('client controllers (headless)', () => {
  it('loadOrgAdmin hides the section without members.read', async () => {
    const d = deps({
      access: {
        currentAccess: async () => ok(access({ permissions: [] })),
      } as unknown as ClientFlowDeps['access'],
    });
    const r = await loadOrgAdmin(d);
    expect(r.ok && r.value.hidden).toBe(true);
  });

  it('loadOrgAdmin derives capability flags for an admin', async () => {
    const d = deps({
      access: {
        currentAccess: async () =>
          ok(
            access({
              permissions: [
                { action: 'members.read', scope: 'own' },
                { action: 'members.invite', scope: 'own' },
                { action: 'members.block', scope: 'own' },
              ],
            }),
          ),
      } as unknown as ClientFlowDeps['access'],
    });
    const r = await loadOrgAdmin(d);
    expect(r.ok && !r.value.hidden && r.value.canInvite).toBe(true);
    expect(r.ok && !r.value.hidden && r.value.canBlock).toBe(true);
    expect(r.ok && !r.value.hidden && r.value.canRemove).toBe(false);
  });

  it('grantMemberPermission appends to the member current permissions', async () => {
    const updatePermissions = vi.fn(async () => ok(undefined));
    const d = deps({
      members: {
        listMembers: async () => ok(MEMBERS),
        updatePermissions,
      } as unknown as ClientFlowDeps['members'],
    });
    await grantMemberPermission(d, {
      accountId: 'acct-1',
      membershipId: 'm-1',
      action: 'members.invite',
    });
    expect(updatePermissions).toHaveBeenCalledWith({
      membershipId: 'm-1',
      permissions: [
        { action: 'customer.read', scope: 'own' },
        { action: 'members.invite', scope: 'own' },
      ],
    });
  });

  it('loadHome combines the snapshot with the org list', async () => {
    const r = await loadHome(deps());
    expect(r.ok && r.value.orgs).toEqual(MINE);
  });

  it('resolveClientGate maps the four states', async () => {
    const anon = await resolveClientGate({
      access: { getSession: async () => err({ tag: 'x', message: 'no' }) },
    } as unknown as ClientFlowDeps);
    expect(anon).toBe('anonymous');

    const noOrg = await resolveClientGate({
      access: {
        getSession: async () => ok({}),
        currentAccess: async () => err({ tag: 'x', message: 'no actor' }),
      },
    } as unknown as ClientFlowDeps);
    expect(noOrg).toBe('no-org');

    const blocked = await resolveClientGate({
      access: {
        getSession: async () => ok({}),
        currentAccess: async () => ok(access({ blocked: true })),
      },
    } as unknown as ClientFlowDeps);
    expect(blocked).toBe('blocked');

    const authed = await resolveClientGate(deps());
    expect(authed).toBe('authenticated');
  });
});
