import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../../access/dto';
import {
  type CoverageDto,
  type LoadDirectoryDeps,
  loadDirectory,
} from './directory';

const snapshot: CurrentAccessDto = {
  membershipId: 'mem',
  userId: 'owner@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [
    { action: 'access.block', scope: 'any' },
    { action: 'account.disable', scope: 'any' },
  ],
  activeGrants: [],
};

const coverage = (over?: Partial<CoverageDto>): CoverageDto => ({
  phase: 'suspended',
  dormant: false,
  balanceMinor: 5684,
  currency: 'MXN',
  paidThroughAt: null,
  ...over,
});

const deps = (over: Partial<LoadDirectoryDeps> = {}): LoadDirectoryDeps => ({
  access: { currentAccess: async () => ok(snapshot) },
  directory: {
    listStaff: async () =>
      ok([
        { accountId: 'acc-self', email: 'me@x.mx', displayName: 'Me' },
        { accountId: 'acc-2', email: 'b@x.mx', displayName: 'Bee' },
      ]),
    listCustomers: async () =>
      ok([
        { accountId: 'org-1', displayName: 'Clínica', email: 'c@x.mx' },
        { accountId: 'org-2', displayName: 'Farmacia', email: 'f@x.mx' },
      ]),
    listOrphans: async () => ok([]),
  },
  invitations: { listPending: async () => ok([]) },
  billing: {
    coverageFor: async (id) => (id === 'org-1' ? coverage() : null),
  },
  ...over,
});

describe('loadDirectory', () => {
  it('enriches customers with coverage, staff with isSelf, and capabilities', async () => {
    const result = await loadDirectory(deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canBlock).toBe(true);
    expect(result.value.canAdminAccounts).toBe(true);
    expect(
      result.value.staff.find((s) => s.accountId === 'acc-self')?.isSelf,
    ).toBe(true);
    expect(
      result.value.staff.find((s) => s.accountId === 'acc-2')?.isSelf,
    ).toBe(false);
    expect(
      result.value.customers.find((c) => c.accountId === 'org-1')?.coverage
        ?.phase,
    ).toBe('suspended');
  });

  it('is fail-soft: a customer with no coverage still appears', async () => {
    const result = await loadDirectory(deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const org2 = result.value.customers.find((c) => c.accountId === 'org-2');
    expect(org2).toBeDefined();
    expect(org2?.coverage).toBeNull();
  });

  it('drops capability flags when the actor lacks the permissions', async () => {
    const result = await loadDirectory(
      deps({
        access: {
          currentAccess: async () => ok({ ...snapshot, permissions: [] }),
        },
      }),
    );
    expect(result.ok && result.value.canBlock).toBe(false);
    expect(result.ok && result.value.canAdminAccounts).toBe(false);
  });

  it('propagates a directory gateway error', async () => {
    const result = await loadDirectory(
      deps({
        directory: {
          listStaff: async () =>
            err({ tag: 'app/access-gateway-error', message: 'boom' }),
          listCustomers: async () => ok([]),
          listOrphans: async () => ok([]),
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/access-gateway-error');
  });
});
