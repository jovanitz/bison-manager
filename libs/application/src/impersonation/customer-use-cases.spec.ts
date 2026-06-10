import { describe, expect, it } from 'vitest';
import { testAccessActor } from '../access/testing';
import {
  makeReadCustomerAsSupport,
  makeSearchCustomers,
} from './customer-use-cases';
import { testCustomerAccount, testImpersonationWorld } from './testing';
import { makeImpersonationUseCases } from './use-cases';

describe('searchCustomers', () => {
  it('lets support search the customer directory', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const search = makeSearchCustomers(world.deps);
    const r = await search({
      actor: testAccessActor({ preset: 'support' }),
      query: 'Customer',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toHaveLength(1);
  });

  it('denies customer.search to customers', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const r = await makeSearchCustomers(world.deps)({
      actor: testAccessActor({ preset: 'customer' }),
      query: 'anything',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });
});

describe('readCustomerAsSupport', () => {
  it('denies support without a grant, allows with an active grant on the target', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const read = makeReadCustomerAsSupport(world.deps);
    const support = testAccessActor({ preset: 'support' });

    const blind = await read({ actor: support, accountId: 'acct-customer' });
    expect(blind.ok).toBe(false);
    if (!blind.ok) expect(blind.error.tag).toBe('app/access-denied');

    const start = await makeImpersonationUseCases(
      world.deps,
    ).startImpersonation({
      actor: support,
      targetAccountId: 'acct-customer',
      reason: 'Ticket #42',
    });
    if (!start.ok) throw new Error('setup');
    const grant = world.grants.get(start.value.id);
    if (!grant) throw new Error('setup');

    const sighted = await read({
      actor: testAccessActor({ preset: 'support', grants: [grant] }),
      accountId: 'acct-customer',
    });
    expect(sighted.ok).toBe(true);
  });

  it('lets a customer read their own account without any grant', async () => {
    const world = testImpersonationWorld([testCustomerAccount('acct-1')]);
    const r = await makeReadCustomerAsSupport(world.deps)({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      accountId: 'acct-1',
    });
    expect(r.ok).toBe(true);
  });

  it('returns customer-not-found for a missing target with sufficient access', async () => {
    const world = testImpersonationWorld([]);
    const r = await makeReadCustomerAsSupport(world.deps)({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-ghost' }),
      accountId: 'acct-ghost',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/customer-not-found');
  });
});
