import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { ApiClient } from '@acme/application';
import { createRpcBlockGateway } from './rpc-block-gateway';

const apiWith = (
  handler: (req: { operation: string; body?: unknown }) => ReturnType<ApiClient['request']>,
): ApiClient => ({ request: (req) => handler(req) as never });

describe('createRpcBlockGateway', () => {
  it('calls the right procedure with the right body', async () => {
    const seen: Array<{ op: string; body: unknown }> = [];
    const gateway = createRpcBlockGateway({
      api: apiWith(async (req) => {
        seen.push({ op: req.operation, body: req.body });
        return ok({ data: null });
      }),
    });
    await gateway.blockOrg('acct-1', 'non-payment');
    await gateway.unblockIdentity('user-1');
    expect(seen).toEqual([
      { op: 'org.block', body: { accountId: 'acct-1', reason: 'non-payment' } },
      { op: 'identity.unblock', body: { userId: 'user-1' } },
    ]);
  });

  it('maps 403 to access-denied and others to a gateway error', async () => {
    const denied = createRpcBlockGateway({
      api: apiWith(async () => err({ tag: 'api/status', message: 'no', status: 403 })),
    });
    const r1 = await denied.blockOrg('acct-1');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.tag).toBe('app/access-denied');

    const failed = createRpcBlockGateway({
      api: apiWith(async () => err({ tag: 'api/status', message: 'boom', status: 500 })),
    });
    const r2 = await failed.blockOrg('acct-1');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.tag).toBe('app/access-gateway-error');
  });
});
