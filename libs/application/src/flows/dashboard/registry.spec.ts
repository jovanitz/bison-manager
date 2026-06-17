import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import {
  DASHBOARD_FLOWS,
  type DashboardFlowDeps,
  findDashboardFlow,
} from './registry';
import { resolveAdminGate } from './queries';

const must = (name: string) => {
  const c = findDashboardFlow(name);
  if (!c) throw new Error(`No flow ${name}`);
  return c;
};

const adminSnapshot: CurrentAccessDto = {
  membershipId: 'mem',
  userId: 'owner@acme.test',
  accountId: 'acct-staff',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [
    { action: 'staff.read', scope: 'any' },
    { action: 'access.block', scope: 'any' },
    { action: 'members.read', scope: 'any' },
    { action: 'permissions.update', scope: 'any' },
  ],
  activeGrants: [],
};

const deps = (over: Partial<DashboardFlowDeps> = {}): DashboardFlowDeps =>
  ({
    access: {
      getSession: async () => ok({}),
      currentAccess: async () => ok(adminSnapshot),
    },
    directory: {
      listStaff: async () => ok([]),
      listCustomers: async () => ok([]),
    },
    members: {
      listMembers: async () =>
        ok([
          {
            membershipId: 'm-1',
            userId: 'a@acme.test',
            permissions: [{ action: 'staff.read', scope: 'any' }],
            isRoot: false,
            blocked: false,
          },
        ]),
      updatePermissions: async () => ok(undefined),
      removeMember: async () => ok(undefined),
      setMemberBlocked: async () => ok(undefined),
    },
    invitations: { invite: async () => ok({ invitationId: 'i', token: 't' }) },
    block: {
      blockOrg: async () => ok(undefined),
      unblockOrg: async () => ok(undefined),
      blockIdentity: async () => ok(undefined),
      unblockIdentity: async () => ok(undefined),
    },
    ...over,
  }) as unknown as DashboardFlowDeps;

describe('dashboard flows', () => {
  it('admin gate: authorized for any-scope, forbidden otherwise, blocked, anonymous', async () => {
    expect(await resolveAdminGate(deps())).toBe('authorized');
    expect(
      await resolveAdminGate(
        deps({
          access: {
            getSession: async () => ok({}),
            currentAccess: async () =>
              ok({
                ...adminSnapshot,
                permissions: [{ action: 'customer.read', scope: 'own' }],
              }),
          } as unknown as DashboardFlowDeps['access'],
        }),
      ),
    ).toBe('forbidden');
    expect(
      await resolveAdminGate(
        deps({
          access: {
            getSession: async () => ok({}),
            currentAccess: async () => ok({ ...adminSnapshot, blocked: true }),
          } as unknown as DashboardFlowDeps['access'],
        }),
      ),
    ).toBe('blocked');
    expect(
      await resolveAdminGate(
        deps({
          access: {
            getSession: async () => err({ tag: 'x', message: 'no' }),
          } as unknown as DashboardFlowDeps['access'],
        }),
      ),
    ).toBe('anonymous');
  });

  it('dashboard.load derives canBlock from access.block', async () => {
    const r = await must('dashboard.load').run(deps(), {});
    expect(r.ok && (r.value as { canBlock: boolean }).canBlock).toBe(true);
  });

  it('staff.members.grant appends with the chosen scope, by name', async () => {
    const updatePermissions = vi.fn(async () => ok(undefined));
    const d = deps({
      members: {
        listMembers: async () =>
          ok([
            {
              membershipId: 'm-1',
              userId: 'a@acme.test',
              permissions: [{ action: 'staff.read', scope: 'any' }],
              isRoot: false,
              blocked: false,
            },
          ]),
        updatePermissions,
      } as unknown as DashboardFlowDeps['members'],
    });
    const grant = must('staff.members.grant');
    const input = grant.input.parse({
      accountId: 'acct-staff',
      membershipId: 'm-1',
      action: 'customer.search',
      scope: 'any',
    });
    await grant.run(d, input);
    expect(updatePermissions).toHaveBeenCalledWith({
      membershipId: 'm-1',
      permissions: [
        { action: 'staff.read', scope: 'any' },
        { action: 'customer.search', scope: 'any' },
      ],
    });
  });

  it('access.setBlocked dispatches to the right block op by name', async () => {
    const blockIdentity = vi.fn(async () => ok(undefined));
    const d = deps({
      block: {
        blockOrg: async () => ok(undefined),
        unblockOrg: async () => ok(undefined),
        blockIdentity,
        unblockIdentity: async () => ok(undefined),
      } as unknown as DashboardFlowDeps['block'],
    });
    const cmd = must('access.setBlocked');
    await cmd.run(
      d,
      cmd.input.parse({ subject: 'identity', id: 'u-1', blocked: true }),
    );
    expect(blockIdentity).toHaveBeenCalledWith('u-1');
  });

  it('rejects malformed block payload at the schema boundary', () => {
    const bad = must('access.setBlocked').input.safeParse({
      subject: 'nope',
      id: 'x',
      blocked: true,
    });
    expect(bad.success).toBe(false);
  });

  it('enumerates every dashboard flow with name, kind and schema (MCP discovery)', () => {
    expect(DASHBOARD_FLOWS.length).toBeGreaterThan(0);
    for (const c of DASHBOARD_FLOWS) {
      expect(typeof c.name).toBe('string');
      expect(['query', 'command']).toContain(c.kind);
      expect(c.input).toBeDefined();
    }
  });
});
