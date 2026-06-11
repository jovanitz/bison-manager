import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { ApiClient, CurrentAccessDto } from '@acme/application';
import { createRpcAccessGateway } from './rpc-access-gateway';

const dto: CurrentAccessDto = {
  membershipId: 'membership-1',
  userId: 'user-1',
  accountId: 'acct-1',
  accountStatus: 'active',
  session: {
    id: 'session-1',
    status: 'active',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
  permissions: [{ action: 'customer.read', scope: 'own' }],
  activeGrants: [],
};

const apiReturning = (result: unknown): ApiClient => ({
  request: async () => result as never,
});

describe('createRpcAccessGateway', () => {
  it('unwraps the rpc envelope into the access snapshot', async () => {
    const gateway = createRpcAccessGateway({
      api: apiReturning(ok({ data: dto })),
    });
    const r = await gateway.fetchCurrentAccess();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.permissions).toEqual(dto.permissions);
  });

  it('maps 401/403 to app/access-denied', async () => {
    for (const status of [401, 403]) {
      const gateway = createRpcAccessGateway({
        api: apiReturning(
          err({ tag: 'api/status', message: 'denied', status }),
        ),
      });
      const r = await gateway.fetchCurrentAccess();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
  });

  it('maps transport failures to app/access-gateway-error', async () => {
    const gateway = createRpcAccessGateway({
      api: apiReturning(err({ tag: 'api/network', message: 'offline' })),
    });
    const r = await gateway.fetchCurrentAccess();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-gateway-error');
  });
});
