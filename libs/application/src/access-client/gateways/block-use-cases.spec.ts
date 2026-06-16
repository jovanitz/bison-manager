import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { accessGatewayError } from '../errors';
import { makeBlockUseCases } from './block-use-cases';
import type { BlockGateway } from '../ports';

const record = () => {
  const calls: Array<[string, ...unknown[]]> = [];
  const gateway: BlockGateway = {
    blockOrg: async (id, reason) => {
      calls.push(['blockOrg', id, reason]);
      return ok(undefined);
    },
    unblockOrg: async (id) => {
      calls.push(['unblockOrg', id]);
      return ok(undefined);
    },
    blockIdentity: async (id, reason) => {
      calls.push(['blockIdentity', id, reason]);
      return ok(undefined);
    },
    unblockIdentity: async (id) => {
      calls.push(['unblockIdentity', id]);
      return err(accessGatewayError('down'));
    },
  };
  return { gateway, calls };
};

describe('makeBlockUseCases', () => {
  it('forwards each block/unblock call with its arguments', async () => {
    const { gateway, calls } = record();
    const useCases = makeBlockUseCases({ gateway });
    await useCases.blockOrg('acct-1', 'non-payment');
    await useCases.unblockOrg('acct-1');
    await useCases.blockIdentity('user-1', 'fraud');
    expect(calls).toEqual([
      ['blockOrg', 'acct-1', 'non-payment'],
      ['unblockOrg', 'acct-1'],
      ['blockIdentity', 'user-1', 'fraud'],
    ]);
  });

  it('propagates a gateway failure', async () => {
    const { gateway } = record();
    const useCases = makeBlockUseCases({ gateway });
    const r = await useCases.unblockIdentity('user-1');
    expect(r.ok).toBe(false);
  });
});
