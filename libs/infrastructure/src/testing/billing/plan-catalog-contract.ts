import { describe, expect, it } from 'vitest';
import type { BillingEvent, Plan, PlanEntitlements } from '@acme/domain';
import {
  BILLING_CONTRACT_NOW as NOW,
  billingContractSeed,
  freePlanDrifted,
  makeBillingContractIds,
  proPlan,
} from './billing-store-fixtures';
import type {
  BillingContractIds,
  MakeBillingStore,
} from './billing-store-fixtures';

/**
 * Catalog half of the billing-store contract: idempotent code-floor seeding,
 * key-unique create, version CAS, the singular default marker and the
 * blast-radius preview. Every successful write must land its billing event
 * atomically; every conflicted write must leave the stream untouched.
 */
const planCreated = (plan: Plan, ids: BillingContractIds): BillingEvent => ({
  type: 'plan.created',
  plan,
  actorMembershipId: ids.actorMembership,
  occurredAt: NOW,
});

const planUpdated = (
  before: Plan,
  after: Plan,
  ids: BillingContractIds,
): BillingEvent => ({
  type: 'plan.updated',
  planId: before.id,
  before,
  after,
  actorMembershipId: ids.actorMembership,
  reason: 'contract test',
  occurredAt: NOW,
});

export const planCatalogContract = (
  name: string,
  makeStore: MakeBillingStore,
): void => {
  describe(`PlanCatalogStore contract: ${name}`, () => {
    it('reseeds the code floor idempotently, never overwriting a drifted live plan', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));

      await store.seedDefaults();
      await store.seedDefaults();

      const frees = (await store.plans.listPlans()).filter(
        (p) => p.key === 'free',
      );
      expect(frees).toHaveLength(1);
      expect(frees[0]?.displayName).toBe('Free (drifted)');
      expect(frees[0]?.version).toBe(4);
      // seeding is deploy plumbing, not a staff action — no audit event
      expect(await store.events()).toEqual([]);
    });

    it('creates plans key-unique: a taken key conflicts and writes nothing', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));
      const dupe: Plan = {
        ...proPlan(crypto.randomUUID() as Plan['id']),
        key: 'free',
      };

      expect(
        await store.plans.savePlan(dupe, null, planCreated(dupe, ids)),
      ).toBe('conflict');
      expect(await store.plans.findPlanById(dupe.id)).toBeNull();
      expect(await store.events()).toEqual([]);

      const fresh: Plan = { ...dupe, key: 'team' };
      expect(
        await store.plans.savePlan(fresh, null, planCreated(fresh, ids)),
      ).toBe('ok');
      expect((await store.plans.findPlanByKey('team'))?.id).toBe(fresh.id);
      expect((await store.events()).map((e) => e.type)).toEqual([
        'plan.created',
      ]);
    });

    it('CAS-guards plan updates on the version the staff saw', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));
      const before = freePlanDrifted(ids.planFree);
      const after: Plan = { ...before, displayName: 'Freeh', version: 5 };

      // stale version: nothing written, no event
      expect(
        await store.plans.savePlan(after, 3, planUpdated(before, after, ids)),
      ).toBe('conflict');
      expect((await store.plans.findPlanById(ids.planFree))?.displayName).toBe(
        'Free (drifted)',
      );
      expect(await store.events()).toEqual([]);

      // unknown plan id is a conflict, never an insert
      const ghost: Plan = { ...after, id: crypto.randomUUID() as Plan['id'] };
      expect(
        await store.plans.savePlan(ghost, 4, planUpdated(before, ghost, ids)),
      ).toBe('conflict');

      // the version the staff saw: written, event atomically present
      expect(
        await store.plans.savePlan(after, 4, planUpdated(before, after, ids)),
      ).toBe('ok');
      const stored = await store.plans.findPlanById(ids.planFree);
      expect(stored?.displayName).toBe('Freeh');
      expect(stored?.version).toBe(5);
      expect(stored?.entitlements).toEqual(before.entitlements);
      const events = await store.events();
      expect(events.map((e) => e.type)).toEqual(['plan.updated']);
      expect(events[0]).toMatchObject({
        reason: 'contract test',
        after: { displayName: 'Freeh', version: 5 },
      });
    });

    it('moves the singular default marker atomically with its event', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));
      expect((await store.plans.findDefaultPlan())?.key).toBe('free');

      await store.plans.setDefaultPlan(ids.planPro, {
        type: 'billing.default-plan-changed',
        fromPlanId: ids.planFree,
        toPlanId: ids.planPro,
        actorMembershipId: ids.actorMembership,
        occurredAt: NOW,
      });

      expect((await store.plans.findDefaultPlan())?.id).toBe(ids.planPro);
      expect(
        (await store.plans.findPlanByKey('free'))?.isDefaultForNewOrgs,
      ).toBe(false);
      expect((await store.events()).map((e) => e.type)).toEqual([
        'billing.default-plan-changed',
      ]);
    });

    it('previews the blast radius: over-limit and feature-loss counters', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));

      // free has ['export.csv'] and subscribers with 1 and 4 members
      const tightened: PlanEntitlements = {
        limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 3 },
        features: [],
      };
      expect(await store.plans.previewImpact(ids.planFree, tightened)).toEqual({
        wouldGoOverLimit: 1,
        wouldLoseFeature: 2,
      });

      const loosened: PlanEntitlements = {
        limits: { maxOrganizationsOwned: null, maxMembersPerOrg: null },
        features: ['export.csv'],
      };
      expect(await store.plans.previewImpact(ids.planFree, loosened)).toEqual({
        wouldGoOverLimit: 0,
        wouldLoseFeature: 0,
      });

      // the staff instruments read the same subscriber set, since-ordered
      expect(await store.plans.countSubscribers(ids.planFree)).toBe(2);
      expect(await store.plans.listSubscribers(ids.planFree)).toEqual([
        { accountId: ids.acctLone, since: '2026-05-01T00:00:00.000Z' },
        { accountId: ids.acctCrowded, since: '2026-06-01T00:00:00.000Z' },
      ]);
    });
  });
};
