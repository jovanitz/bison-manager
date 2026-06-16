import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { ApiClient } from '@acme/application';
import { createRpcMembersGateway } from './rpc-members-gateway';

const apiWith = (
  handler: (req: {
    operation: string;
    body?: unknown;
  }) => ReturnType<ApiClient['request']>,
): ApiClient => ({ request: (req) => handler(req) as never });

describe('createRpcMembersGateway', () => {
  it('lists members through members.list', async () => {
    const gateway = createRpcMembersGateway({
      api: apiWith(async () =>
        ok({
          data: [
            {
              membershipId: 'm-1',
              userId: 'u',
              permissions: [],
              isRoot: false,
            },
          ],
        }),
      ),
    });
    const r = await gateway.listMembers('acct-1');
    expect(r.ok && r.value[0]?.membershipId).toBe('m-1');
  });

  it('updates permissions through permissions.update', async () => {
    let sent: unknown;
    const gateway = createRpcMembersGateway({
      api: apiWith(async (req) => {
        sent = req.body;
        return ok({ data: null });
      }),
    });
    const r = await gateway.updatePermissions({
      membershipId: 'm-1',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    expect(r.ok).toBe(true);
    expect(sent).toEqual({
      membershipId: 'm-1',
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
  });

  it('removes a member through members.remove', async () => {
    let sent: { operation: string; body?: unknown } | undefined;
    const gateway = createRpcMembersGateway({
      api: apiWith(async (req) => {
        sent = req;
        return ok({ data: null });
      }),
    });
    const r = await gateway.removeMember({ membershipId: 'm-1' });
    expect(r.ok).toBe(true);
    expect(sent?.operation).toBe('members.remove');
    expect(sent?.body).toEqual({ membershipId: 'm-1' });
  });

  it('routes setMemberBlocked to members.block / members.unblock', async () => {
    const seen: string[] = [];
    const gateway = createRpcMembersGateway({
      api: apiWith(async (req) => {
        seen.push(req.operation);
        return ok({ data: null });
      }),
    });
    await gateway.setMemberBlocked({ membershipId: 'm-1', blocked: true });
    await gateway.setMemberBlocked({ membershipId: 'm-1', blocked: false });
    expect(seen).toEqual(['members.block', 'members.unblock']);
  });

  it('maps 403 to access-denied and other failures to a gateway error', async () => {
    const denied = createRpcMembersGateway({
      api: apiWith(async () =>
        err({ tag: 'api/status', message: 'no', status: 403 }),
      ),
    });
    const r1 = await denied.updatePermissions({
      membershipId: 'm',
      permissions: [],
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.tag).toBe('app/access-denied');

    const failed = createRpcMembersGateway({
      api: apiWith(async () =>
        err({ tag: 'api/status', message: 'conflict', status: 409 }),
      ),
    });
    const r2 = await failed.updatePermissions({
      membershipId: 'm',
      permissions: [],
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.tag).toBe('app/access-gateway-error');
  });
});
