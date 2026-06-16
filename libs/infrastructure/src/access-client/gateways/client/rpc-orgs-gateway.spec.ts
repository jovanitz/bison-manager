import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { ApiClient } from '@acme/application';
import { createRpcOrgsGateway } from './rpc-orgs-gateway';

const apiWith = (
  handler: (req: {
    operation: string;
    body?: unknown;
  }) => ReturnType<ApiClient['request']>,
): ApiClient => ({ request: (req) => handler(req) as never });

describe('createRpcOrgsGateway', () => {
  it('lists memberships and switches account through the right procedures', async () => {
    const seen: Array<{ op: string; body: unknown }> = [];
    const gateway = createRpcOrgsGateway({
      api: apiWith(async (req) => {
        seen.push({ op: req.operation, body: req.body });
        return ok({
          data: req.operation === 'memberships.mine' ? [] : { accountId: 'a' },
        });
      }),
    });
    await gateway.listMyMemberships();
    await gateway.switchAccount('m-1');
    expect(seen).toEqual([
      { op: 'memberships.mine', body: {} },
      { op: 'session.switch-account', body: { membershipId: 'm-1' } },
    ]);
  });

  it('maps 403 to access-denied', async () => {
    const gateway = createRpcOrgsGateway({
      api: apiWith(async () =>
        err({ tag: 'api/status', message: 'no', status: 403 }),
      ),
    });
    const r = await gateway.listMyMemberships();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });
});
