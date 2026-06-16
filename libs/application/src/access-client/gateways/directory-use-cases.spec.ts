import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { AccountId } from '@acme/domain';
import { accessDenied } from '../../access/errors';
import { makeDirectoryUseCases } from './directory-use-cases';
import type { DirectoryGateway } from '../ports';

const STAFF = [
  {
    accountId: 'acct-staff' as AccountId,
    email: 'a@acme.test',
    displayName: 'A',
  },
];
const CUSTOMERS = [
  {
    accountId: 'acct-cust' as AccountId,
    displayName: 'Casa',
    email: 'ops@casa.test',
  },
];

const fakeGateway = (
  overrides: Partial<DirectoryGateway> = {},
): DirectoryGateway => ({
  listStaff: async () => ok(STAFF),
  listCustomers: async () => ok(CUSTOMERS),
  ...overrides,
});

describe('makeDirectoryUseCases', () => {
  it('forwards the staff and customer reads from the gateway', async () => {
    const useCases = makeDirectoryUseCases({ gateway: fakeGateway() });

    const staff = await useCases.listStaff();
    const customers = await useCases.listCustomers();

    expect(staff.ok && staff.value).toEqual(STAFF);
    expect(customers.ok && customers.value).toEqual(CUSTOMERS);
  });

  it('propagates a gateway failure unchanged', async () => {
    const useCases = makeDirectoryUseCases({
      gateway: fakeGateway({
        listStaff: async () => err(accessDenied('Not allowed.')),
      }),
    });

    const staff = await useCases.listStaff();
    expect(staff.ok).toBe(false);
    if (!staff.ok) expect(staff.error.tag).toBe('app/access-denied');
  });
});
