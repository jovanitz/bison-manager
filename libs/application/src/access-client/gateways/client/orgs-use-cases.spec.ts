import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { accessGatewayError } from '../../errors';
import { makeOrgsUseCases } from './orgs-use-cases';
import type { MyMembershipDto, OrgsGateway } from '../../ports';

const MINE: ReadonlyArray<MyMembershipDto> = [
  {
    membershipId: 'm-1',
    accountId: 'acct-1',
    accountKind: 'customer',
    accountStatus: 'active',
    accountName: 'Casa Pampa',
  },
];

const gateway = (overrides: Partial<OrgsGateway> = {}): OrgsGateway => ({
  createOrganization: async () => ok({ accountId: 'acct-new' }),
  listMyMemberships: async () => ok(MINE),
  switchAccount: async (id) => ok({ accountId: `acct-of-${id}` }),
  ...overrides,
});

describe('makeOrgsUseCases', () => {
  it('lists my orgs and switches account', async () => {
    const useCases = makeOrgsUseCases({ gateway: gateway() });
    const mine = await useCases.listMyMemberships();
    expect(mine.ok && mine.value).toEqual(MINE);
    const switched = await useCases.switchAccount('m-9');
    expect(switched.ok && switched.value.accountId).toBe('acct-of-m-9');
  });

  it('propagates a gateway failure', async () => {
    const useCases = makeOrgsUseCases({
      gateway: gateway({
        listMyMemberships: async () => err(accessGatewayError('down')),
      }),
    });
    const mine = await useCases.listMyMemberships();
    expect(mine.ok).toBe(false);
  });
});
