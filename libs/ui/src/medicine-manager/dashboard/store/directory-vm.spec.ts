import { describe, expect, it } from 'vitest';
import type { DirectoryReadModel } from '@acme/application';
import { toDirectoryVM } from './directory-vm';

const NOW = '2026-07-13T00:00:00.000Z';

const invite = (invitationId: string, expiresAt: string) => ({
  invitationId,
  accountId: 'org-1',
  email: `${invitationId}@x.mx`,
  createdAt: '2026-07-01T00:00:00.000Z',
  expiresAt,
  seatBlockedAt: null,
});

const readModel: DirectoryReadModel = {
  staff: [
    {
      accountId: 'acc-self',
      email: 'me@x.mx',
      displayName: 'Me',
      isSelf: true,
    },
    { accountId: 'acc-2', email: null, displayName: null, isSelf: false },
  ],
  customers: [
    {
      accountId: 'org-1',
      displayName: 'Clínica',
      email: 'c@x.mx',
      coverage: {
        phase: 'suspended',
        dormant: true,
        balanceMinor: 5684,
        currency: 'MXN',
        paidThroughAt: null,
      },
    },
    {
      accountId: 'org-2',
      displayName: 'Sin billing',
      email: null,
      coverage: null,
    },
  ],
  orphans: [{ userId: 'usr-1', email: null, createdAt: '2026-06-30' }],
  pendingInvitations: [
    invite('past', '2026-07-10T00:00:00.000Z'), // expired
    invite('soon', '2026-07-14T00:00:00.000Z'), // ≤ 2 days → expiring
    invite('later', '2026-07-25T00:00:00.000Z'), // pending
  ],
  canBlock: true,
  canAdminAccounts: false,
};

describe('toDirectoryVM', () => {
  it('maps staff, omitting missing email/displayName, keeping isSelf', () => {
    const vm = toDirectoryVM(readModel, NOW);
    const self = vm.staff.find((s) => s.accountId === 'acc-self');
    expect(self?.isSelf).toBe(true);
    expect(self?.email).toBe('me@x.mx');
    const other = vm.staff.find((s) => s.accountId === 'acc-2');
    expect(other?.isSelf).toBe(false);
    expect(other && 'email' in other).toBe(false);
  });

  it('maps customer coverage to phase / dormant — no fabricated overdue count', () => {
    const vm = toDirectoryVM(readModel, NOW);
    const org1 = vm.customers.find((c) => c.accountId === 'org-1');
    expect(org1?.phase).toBe('suspended');
    expect(org1?.dormant).toBe(true);
    // Payment health is derived downstream from `phase`; the VM invents nothing.
    expect(org1 && 'overduePayments' in org1).toBe(false);
    const org2 = vm.customers.find((c) => c.accountId === 'org-2');
    expect(org2 && 'phase' in org2).toBe(false); // no coverage → no phase
    expect(org2?.dormant).toBe(false);
  });

  it('derives invitation status from expiry vs now', () => {
    const vm = toDirectoryVM(readModel, NOW);
    const status = (id: string) =>
      vm.pendingInvitations.find((i) => i.invitationId === id)?.status;
    expect(status('past')).toBe('expired');
    expect(status('soon')).toBe('expiring');
    expect(status('later')).toBe('pending');
  });

  it('passes capability flags through and marks not-loading', () => {
    const vm = toDirectoryVM(readModel, NOW);
    expect(vm.canBlock).toBe(true);
    expect(vm.canAdminAccounts).toBe(false);
    expect(vm.loading).toBe(false);
  });
});
