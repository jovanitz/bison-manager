import { describe, expect, it } from 'vitest';
import type {
  BillingSummaryDto,
  LedgerViewDto,
  OrgDetailViewModel,
} from '@acme/application';
import { toOrgDetailVM } from './org-detail-vm';

const summary = (over: Partial<BillingSummaryDto> = {}): BillingSummaryDto => ({
  accountId: 'org-1',
  planId: 'plan-pro',
  planKey: 'pro',
  planName: 'Pro',
  phase: 'active',
  trialEndsAt: '2026-04-14T00:00:00Z',
  paidThroughAt: '2026-12-31T00:00:00Z',
  seats: { used: 12, max: 25 },
  overLimit: false,
  price: { amountCents: 4900, currency: 'MXN', interval: 'month' },
  features: [],
  heldForPayment: false,
  ...over,
});

const LEDGER: LedgerViewDto = {
  currency: 'MXN',
  entries: [
    {
      id: 'chg-1',
      date: '2026-07-05T00:00:00Z',
      kind: 'charge',
      amountMinor: 5684,
      runningBalanceMinor: 5684,
      chargeStatus: 'paid',
      subtotalMinor: 4900,
      taxMinor: 784,
      period: { from: '2026-07-05T00:00:00Z', to: '2026-08-05T00:00:00Z' },
    },
    {
      id: 'pay-1',
      date: '2026-07-08T00:00:00Z',
      kind: 'payment',
      amountMinor: -5684,
      runningBalanceMinor: 0,
    },
  ],
};

const rm = (over: Partial<OrgDetailViewModel> = {}): OrgDetailViewModel => ({
  accountId: 'org-1',
  name: 'Clínica Norte',
  email: 'admin@norte.mx',
  status: 'active',
  createdAt: '2026-03-14T00:00:00Z',
  owner: { name: 'Lucía', email: 'lucia@norte.mx' },
  canViewMembers: true,
  canManageMembers: true,
  canImpersonate: true,
  members: [
    {
      membershipId: 'm-1',
      userId: 'u-1',
      displayName: 'Lucía Fuentes',
      email: 'lucia@norte.mx',
      roleNames: ['Owner'],
      isAccountOwner: true,
      isRoot: false,
      blocked: false,
    },
  ],
  canManageBilling: true,
  ...over,
});

describe('toOrgDetailVM', () => {
  it('maps identity + members, dates to YYYY-MM-DD, never offers impersonation', () => {
    const vm = toOrgDetailVM(rm());
    expect(vm.name).toBe('Clínica Norte');
    expect(vm.createdAt).toBe('2026-03-14');
    expect(vm.canImpersonate).toBe(false); // deferred feature — always hidden
    expect(vm.members[0]?.name).toBe('Lucía Fuentes');
    expect(vm.members[0]?.role).toBe('Owner');
    expect(vm.members[0]?.isOwner).toBe(true);
  });

  it('translates past_due → grace / suspended on the payment hold', () => {
    const grace = toOrgDetailVM(
      rm({ subscription: summary({ phase: 'past_due' }) }),
    );
    expect(grace.subscription?.phase).toBe('grace');
    const suspended = toOrgDetailVM(
      rm({
        subscription: summary({ phase: 'past_due', heldForPayment: true }),
      }),
    );
    expect(suspended.subscription?.phase).toBe('suspended');
  });

  it('formats the subscription card (price, seats, paid-through)', () => {
    const vm = toOrgDetailVM(rm({ subscription: summary() }));
    expect(vm.subscription?.priceLabel).toBe('$49 / month');
    expect(vm.subscription?.seatsUsed).toBe(12);
    expect(vm.subscription?.paidThroughAt).toBe('2026-12-31');
  });

  it('maps the ledger newest-first with signed labels + tax note + running balance', () => {
    const vm = toOrgDetailVM(rm({ subscription: summary(), ledger: LEDGER }));
    const rows = vm.ledger ?? [];
    expect(rows[0]?.kind).toBe('payment'); // newest first
    expect(rows[0]?.amountLabel).toBe('−$56.84');
    expect(rows[1]?.kind).toBe('charge');
    expect(rows[1]?.amountLabel).toBe('+$56.84');
    expect(rows[1]?.description).toBe('Jul 2026');
    expect(rows[1]?.taxNote).toBe('$49.00 + $7.84 IVA');
    expect(rows[1]?.balanceLabel).toBe('$56.84');
  });

  it('derives the balance from the ledger final running total', () => {
    const clear = toOrgDetailVM(
      rm({ subscription: summary(), ledger: LEDGER }),
    );
    expect(clear.subscription?.balance).toEqual({
      label: '$0.00',
      state: 'clear',
    });
    const owing: LedgerViewDto = {
      currency: 'MXN',
      entries: [
        {
          id: 'c',
          date: '2026-07-05T00:00:00Z',
          kind: 'charge',
          amountMinor: 5684,
          runningBalanceMinor: 5684,
          chargeStatus: 'open',
        },
      ],
    };
    const owes = toOrgDetailVM(rm({ subscription: summary(), ledger: owing }));
    expect(owes.subscription?.balance).toEqual({
      label: '$56.84',
      state: 'owes',
    });
  });

  it('hides the ledger + subscription when absent (no billing.read)', () => {
    const vm = toOrgDetailVM(
      rm({ subscription: undefined, ledger: undefined }),
    );
    expect(vm.subscription).toBeUndefined();
    expect(vm.ledger).toBeUndefined();
  });
});
