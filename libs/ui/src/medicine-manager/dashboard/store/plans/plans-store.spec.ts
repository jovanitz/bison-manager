import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { PlanDto } from '@acme/application';
import { createPlansStore, type PlansStoreDeps } from './plans-store';

const planDto: PlanDto = {
  id: 'plan_2',
  key: 'pro',
  displayName: 'Pro',
  internalNote: 'The standard paid tier.',
  status: 'active',
  visibility: 'public',
  isDefaultForNewOrgs: false,
  entitlements: {
    limits: { maxOrganizationsOwned: 3, maxMembersPerOrg: 25 },
    features: ['export.csv'],
  },
  trialMonths: 1,
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  priceSetAt: '2026-01-01T00:00:00Z',
  version: 7,
  subscribers: 37,
};

const snapshotWith = (permissions: readonly unknown[]) => ({
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

const preview = { subscribers: 37, wouldGoOverLimit: 4, wouldLoseFeature: 2 };

type Over = {
  readonly access?: Record<string, unknown>;
  readonly billing?: Record<string, unknown>;
};

const makeDeps = (over: Over = {}) =>
  ({
    access: over.access ?? {
      currentAccess: async () =>
        ok(snapshotWith([{ action: 'plans.manage', scope: 'any' }])),
    },
    // Billing MERGES the overrides over the defaults so a spy replaces one
    // method while the read path (listPlans/listSubscribers) keeps working.
    billing: {
      listPlans: async () => ok([planDto]),
      listSubscribers: async () => ok([{ accountId: 'a', since: 'x' }]),
      createPlan: async () => ok(planDto),
      previewPlanUpdate: async () => ok(preview),
      updatePlan: async () => ok(planDto),
      retirePlan: async () => ok(planDto),
      resetPlan: async () => ok(planDto),
      setDefaultPlan: async () => ok(undefined),
      ...(over.billing ?? {}),
    },
  }) as unknown as PlansStoreDeps;

describe('createPlansStore', () => {
  it('load maps the catalog and enriches the subscriber count', async () => {
    const store = createPlansStore(makeDeps());
    await store.getState().load();
    const vm = store.getState().vm;
    expect(vm.canManage).toBe(true);
    expect(vm.loading).toBe(false);
    expect(vm.plans[0]?.planId).toBe('plan_2');
    // loadPlansCatalog overwrites subscribers with the listSubscribers length.
    expect(vm.plans[0]?.subscribers).toBe(1);
  });

  it('short-circuits to an empty gated catalog without plans.manage', async () => {
    const listPlans = vi.fn(async () => ok([planDto]));
    const store = createPlansStore(
      makeDeps({
        access: { currentAccess: async () => ok(snapshotWith([])) },
        billing: { listPlans },
      }),
    );
    await store.getState().load();
    expect(store.getState().vm.canManage).toBe(false);
    expect(store.getState().vm.plans).toHaveLength(0);
    // The list is gated: without plans.manage the API is never even called.
    expect(listPlans).not.toHaveBeenCalled();
  });

  it('retire dispatches with its audited reason and reloads', async () => {
    const retirePlan = vi.fn(async () => ok(planDto));
    const store = createPlansStore(makeDeps({ billing: { retirePlan } }));
    await store.getState().load();
    store.getState().openRetire('plan_2');
    expect(store.getState().vm.pendingRetire?.planId).toBe('plan_2');
    await store.getState().confirmRetire('promo ended');
    expect(retirePlan).toHaveBeenCalledWith({
      planId: 'plan_2',
      reason: 'promo ended',
    });
    // Overlay closed on success.
    expect(store.getState().vm.pendingRetire).toBeUndefined();
  });

  it('set-default dispatches with its reason', async () => {
    const setDefaultPlan = vi.fn(async () => ok(undefined));
    const store = createPlansStore(makeDeps({ billing: { setDefaultPlan } }));
    await store.getState().load();
    store.getState().openSetDefault('plan_2');
    await store.getState().confirmSetDefault('make pro default');
    expect(setDefaultPlan).toHaveBeenCalledWith({
      planId: 'plan_2',
      reason: 'make pro default',
    });
  });

  it('edit previews, then commits at the CAS version the staff saw', async () => {
    const previewPlanUpdate = vi.fn(async () => ok(preview));
    const updatePlan = vi.fn(async () => ok(planDto));
    const store = createPlansStore(
      makeDeps({ billing: { previewPlanUpdate, updatePlan } }),
    );
    await store.getState().load();
    store.getState().openEdit('plan_2');
    const draft = store.getState().vm.form?.draft;
    await store.getState().submitForm({ ...draft!, displayName: 'Pro Plus' });
    expect(previewPlanUpdate).toHaveBeenCalledTimes(1);
    expect(store.getState().vm.pendingEdit?.planName).toBe('Pro Plus');
    await store.getState().confirmEdit('rename');
    expect(updatePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan_2',
        expectedVersion: 7, // echoed from the loaded PlanDto.version
        reason: 'rename',
      }),
    );
  });

  it('create dispatches the flattened DTO with its reason', async () => {
    const createPlan = vi.fn(async () => ok(planDto));
    const store = createPlansStore(makeDeps({ billing: { createPlan } }));
    await store.getState().load();
    store.getState().openCreate();
    const draft = store.getState().vm.form?.draft;
    await store.getState().submitForm({ ...draft! }, 'new plan');
    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'new plan' }),
    );
  });
});
