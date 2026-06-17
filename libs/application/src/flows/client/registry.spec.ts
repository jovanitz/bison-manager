import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type { MemberSummaryDto } from '../../access-client/ports';
import { CLIENT_FLOWS, type ClientFlowDeps, findClientFlow } from './registry';

/**
 * Mock-MCP proof: drive the client flows THROUGH THE REGISTRY by name, with no
 * React and no real transport — only fake in-memory gateways. This is exactly
 * what a customer-facing MCP server would do: enumerate the registry, validate
 * a payload against the entry's Zod schema, and `run` it against injected deps.
 * The SAME controllers the UI store uses run here unchanged.
 */
const must = (name: string) => {
  const c = findClientFlow(name);
  if (!c) throw new Error(`No flow ${name}`);
  return c;
};

const ADMIN: CurrentAccessDto = {
  membershipId: 'mem-admin',
  userId: 'admin@org.test',
  accountId: 'acct-1',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [
    { action: 'members.read', scope: 'own' },
    { action: 'members.invite', scope: 'own' },
  ],
  activeGrants: [],
};

const MEMBERS: ReadonlyArray<MemberSummaryDto> = [
  {
    membershipId: 'm-1',
    userId: 'alice@org.test',
    permissions: [{ action: 'customer.read', scope: 'own' }],
    isRoot: false,
    blocked: false,
  },
];

const fakeDeps = (over: {
  readonly updatePermissions?: ClientFlowDeps['members']['updatePermissions'];
}): ClientFlowDeps =>
  ({
    access: {
      currentAccess: async () => ok(ADMIN),
      getSession: async () => ok({}),
    },
    members: {
      listMembers: async () => ok(MEMBERS),
      updatePermissions: over.updatePermissions ?? (async () => ok(undefined)),
      removeMember: async () => ok(undefined),
      setMemberBlocked: async () => ok(undefined),
    },
    invitations: {
      invite: async () => ok({ invitationId: 'i', token: 'tok' }),
    },
    orgs: { listMyMemberships: async () => ok([]) },
  }) as unknown as ClientFlowDeps;

describe('mock-MCP: drive client flows through the registry', () => {
  it('runs the load query by name, no React', async () => {
    const load = must('org.load');
    expect(load.kind).toBe('query');
    const r = await load.run(fakeDeps({}), load.input.parse({}));
    expect(r.ok).toBe(true);
  });

  it('grants by name, validating input via zod, appending to current perms', async () => {
    const updatePermissions = vi.fn(async () => ok(undefined));
    const grant = must('org.members.grant');
    const input = grant.input.parse({
      accountId: 'acct-1',
      membershipId: 'm-1',
      action: 'members.invite',
    });
    const r = await grant.run(fakeDeps({ updatePermissions }), input);
    expect(r.ok).toBe(true);
    expect(updatePermissions).toHaveBeenCalledWith({
      membershipId: 'm-1',
      permissions: [
        { action: 'customer.read', scope: 'own' },
        { action: 'members.invite', scope: 'own' },
      ],
    });
  });

  it('rejects a malformed payload at the schema boundary', () => {
    const bad = must('org.members.grant').input.safeParse({
      membershipId: 'm-1',
    });
    expect(bad.success).toBe(false);
  });

  it('every entry is enumerable with name, kind and schema', () => {
    expect(CLIENT_FLOWS.length).toBeGreaterThan(0);
    for (const c of CLIENT_FLOWS) {
      expect(typeof c.name).toBe('string');
      expect(['query', 'command']).toContain(c.kind);
      expect(c.input).toBeDefined();
    }
  });
});
