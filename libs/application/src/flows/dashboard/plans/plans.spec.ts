import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../../access/dto';
import type {
  BillingGateway,
  PlanDto,
} from '../../../access-client/billing-ports';
import type { AccessClientUseCases } from '../../../access-client/use-cases';
import { loadPlansCatalog } from './plans';
import { markPaid, setOverride, updatePlan } from './commands';

const plan = (over: Partial<PlanDto> = {}): PlanDto => ({
  id: 'plan-basic',
  key: 'basico',
  displayName: 'Básico',
  internalNote: 'Default entry plan.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: true,
  entitlements: {
    limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 10 },
    features: ['reports'],
  },
  trialMonths: 1,
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  priceSetAt: '2026-01-01T00:00:00Z',
  version: 3,
  ...over,
});

const snapshot = (
  permissions: CurrentAccessDto['permissions'],
): CurrentAccessDto => ({
  membershipId: 'mem',
  userId: 'owner@acme.test',
  accountId: 'acct-staff',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

const access = (perms: CurrentAccessDto['permissions']): AccessClientUseCases =>
  ({ currentAccess: async () => ok(snapshot(perms)) }) as AccessClientUseCases;

const manager = access([{ action: 'plans.manage', scope: 'any' }]);

const gateway = (over: Partial<BillingGateway> = {}) =>
  ({
    listPlans: async () => ok([plan(), plan({ id: 'plan-pro', key: 'pro' })]),
    listSubscribers: async () =>
      ok([
        { accountId: 'org-1', since: '2026-02-01' },
        { accountId: 'org-2', since: '2026-03-01' },
      ]),
    ...over,
  }) as BillingGateway;

describe('loadPlansCatalog', () => {
  it('with plans.manage: lists plans enriched with subscriber counts', async () => {
    const result = await loadPlansCatalog({
      access: manager,
      billing: gateway(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canManage).toBe(true);
    expect(result.value.plans.map((p) => p.subscribers)).toEqual([2, 2]);
    expect(result.value.plans[0]?.key).toBe('basico');
  });

  it('without plans.manage: gated view-model, catalog never fetched', async () => {
    const listPlans = vi.fn();
    const result = await loadPlansCatalog({
      access: access([{ action: 'staff.read', scope: 'any' }]),
      billing: gateway({ listPlans }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ plans: [], canManage: false });
    expect(listPlans).not.toHaveBeenCalled();
  });

  it('a subscriber-count failure keeps the plan, just without a count', async () => {
    const result = await loadPlansCatalog({
      access: manager,
      billing: gateway({
        listSubscribers: async () =>
          err({ tag: 'app/access-gateway-error', message: 'boom' }),
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.plans).toHaveLength(2);
    expect(result.value.plans[0]?.subscribers).toBeUndefined();
  });

  it('propagates a catalog gateway error', async () => {
    const result = await loadPlansCatalog({
      access: manager,
      billing: gateway({
        listPlans: async () => err({ tag: 'app/access-denied', message: 'no' }),
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-denied');
  });
});

describe('billing command wrappers', () => {
  it('updatePlan drops the zod-optional undefineds from changes', async () => {
    const update = vi.fn(async () => ok(plan()));
    await updatePlan(
      { billing: gateway({ updatePlan: update }) },
      {
        planId: 'plan-basic',
        changes: { displayName: 'Nuevo', price: undefined },
        expectedVersion: 3,
        reason: 'rename',
      },
    );
    expect(update).toHaveBeenCalledWith({
      planId: 'plan-basic',
      changes: { displayName: 'Nuevo' },
      expectedVersion: 3,
      reason: 'rename',
    });
  });

  it('markPaid omits an absent amountNote', async () => {
    const paid = vi.fn(async () => ok(undefined));
    await markPaid(
      { billing: gateway({ markPaid: paid }) },
      { accountId: 'org-1', paidThrough: '2026-09-01', reason: 'transfer' },
    );
    expect(paid).toHaveBeenCalledWith({
      accountId: 'org-1',
      paidThrough: '2026-09-01',
      reason: 'transfer',
    });
  });

  it('setOverride passes null through and drops undefined subfields', async () => {
    const override = vi.fn(async () => ok(undefined));
    const deps = { billing: gateway({ setOverride: override }) };
    await setOverride(deps, {
      accountId: 'org-1',
      overrides: null,
      reason: 'clear',
    });
    expect(override).toHaveBeenCalledWith({
      accountId: 'org-1',
      overrides: null,
      reason: 'clear',
    });
    await setOverride(deps, {
      accountId: 'org-1',
      overrides: { features: ['reports'], limits: undefined },
      reason: 'keep feature',
    });
    expect(override).toHaveBeenLastCalledWith({
      accountId: 'org-1',
      overrides: { features: ['reports'] },
      reason: 'keep feature',
    });
  });
});
