import { describe, expect, it } from 'vitest';
import { err, fixedClock, ok, sequentialIdGenerator } from '@acme/shared';
import { accessPresetPermissions } from '@acme/domain';
import type { BillingEvent, Plan, Subscription } from '@acme/domain';
import { planLimitExceeded } from '../billing-subscriptions/errors';
import { freePlan } from '../billing-subscriptions/testing';
import type { NewIdentityMembership } from './ports';
import { makeCreateOrganization } from './create-organization';

const NOW = '2026-06-15T12:00:00.000Z';
/** `freePlan()` carries 3 trial months: NOW + 3 calendar months. */
const TRIAL_ENDS = '2026-09-15T12:00:00.000Z';

const makeWorld = (input?: {
  readonly plan?: Plan | null;
  readonly atOrgLimit?: boolean;
  readonly trialUsed?: boolean;
}) => {
  const created: NewIdentityMembership[] = [];
  const subscriptions: Subscription[] = [];
  const billingEvents: BillingEvent[] = [];
  const seeded: string[] = [];
  const createOrganization = makeCreateOrganization({
    onboarding: {
      createCustomerMembership: async (m, sub, event) => {
        created.push(m);
        subscriptions.push(sub);
        billingEvents.push(event);
      },
    },
    installDefaults: async (accountId) => {
      seeded.push(accountId);
    },
    billing: {
      guardOrgCreation: async () =>
        input?.atOrgLimit
          ? err(planLimitExceeded('Org-ownership limit reached.'))
          : ok(undefined),
      hasTrialConsumedByUser: async () => input?.trialUsed ?? false,
      defaultPlan: async () =>
        input?.plan === undefined ? freePlan() : input.plan,
    },
    clock: fixedClock(new Date(NOW)),
    ids: sequentialIdGenerator('id'),
  });
  return { createOrganization, created, subscriptions, billingEvents, seeded };
};

describe('makeCreateOrganization', () => {
  it('creates an org with the customer-admin preset and returns its ids', async () => {
    const world = makeWorld();
    const r = await world.createOrganization({
      userId: 'user-1',
      email: 'me@acme.test',
      name: '  Casa Pampa  ',
    });
    expect(r.ok).toBe(true);
    expect(world.created).toHaveLength(1);
    expect(world.created[0]?.displayName).toBe('Casa Pampa');
    expect(world.created[0]?.permissions).toEqual(
      accessPresetPermissions('customer-admin'),
    );
    if (r.ok) {
      expect(r.value.accountId).toBe(world.created[0]?.accountId);
      expect(r.value.membershipId).toBe(world.created[0]?.membershipId);
      // ADR-0012: the new org's default roles are seeded on creation
      expect(world.seeded).toEqual([r.value.accountId]);
    }
  });

  it('births the subscription atomically with the org (ADR-0016 Decision 2)', async () => {
    const world = makeWorld();
    const r = await world.createOrganization({
      userId: 'user-1',
      email: 'me@acme.test',
      name: 'Casa Pampa',
    });
    expect(r.ok).toBe(true);
    const sub = world.subscriptions[0];
    expect(sub).toMatchObject({
      accountId: r.ok ? r.value.accountId : '',
      planId: freePlan().id,
      createdByUserId: 'user-1',
      startedAt: NOW,
      trialEndsAt: TRIAL_ENDS, // frozen at subscribe (D3)
      paidThroughAt: null,
      canceledAt: null,
      overrides: null,
    });
    // the birth event travels into the SAME port call (one transaction)
    expect(world.billingEvents[0]).toMatchObject({
      type: 'subscription.started',
      subscriptionId: sub?.id,
      accountId: sub?.accountId,
      planId: sub?.planId,
      trialEndsAt: TRIAL_ENDS,
      occurredAt: NOW,
    });
  });

  it('denies at the ownership limit without touching the store', async () => {
    const world = makeWorld({ atOrgLimit: true });
    const r = await world.createOrganization({
      userId: 'user-1',
      email: null,
      name: 'Second Org',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/plan-limit-exceeded');
    expect(world.created).toHaveLength(0);
    expect(world.subscriptions).toHaveLength(0);
  });

  it('fails closed when no default plan exists (never unlimited)', async () => {
    const world = makeWorld({ plan: null });
    const r = await world.createOrganization({
      userId: 'user-1',
      email: null,
      name: 'Orphan Org',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/default-plan-missing');
    expect(world.created).toHaveLength(0);
  });

  it('births a second org with its trial already consumed (trial-once, D3)', async () => {
    const world = makeWorld({ trialUsed: true });
    const r = await world.createOrganization({
      userId: 'user-1',
      email: null,
      name: 'Second Org',
    });
    expect(r.ok).toBe(true);
    // trialEndsAt === startedAt: born past its trial, no fresh free window
    expect(world.subscriptions[0]?.trialEndsAt).toBe(NOW);
    expect(world.subscriptions[0]?.startedAt).toBe(NOW);
  });

  it('rejects a blank name without touching the store', async () => {
    const world = makeWorld();
    const r = await world.createOrganization({
      userId: 'user-1',
      email: null,
      name: '   ',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/invalid-org-name');
    expect(world.created).toHaveLength(0);
  });
});
