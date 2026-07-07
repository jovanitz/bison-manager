import { describe, expect, it } from 'vitest';
import type { BillingEvent, Subscription } from '@acme/domain';
import {
  BILLING_CONTRACT_NOW as NOW,
  billingContractSeed,
  contractSubscription,
  makeBillingContractIds,
} from './billing-store-fixtures';
import type { MakeBillingStore } from './billing-store-fixtures';

/**
 * Subscription half of the billing-store contract: per-account upsert
 * (unique account, immutable birth facts), the once-ever trial budget lookup,
 * CAS-guarded exactly-once trial-expiry recording, and the usage counters the
 * entitlement guards read.
 */
const subscriptionStarted = (sub: Subscription): BillingEvent => ({
  type: 'subscription.started',
  subscriptionId: sub.id,
  accountId: sub.accountId,
  planId: sub.planId,
  createdByUserId: sub.createdByUserId,
  trialEndsAt: sub.trialEndsAt,
  occurredAt: NOW,
});

export const subscriptionContract = (
  name: string,
  makeStore: MakeBillingStore,
): void => {
  describe(`SubscriptionStore contract: ${name}`, () => {
    it('upserts one subscription per account, keeping the birth facts', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));
      const born = contractSubscription({
        id: crypto.randomUUID() as Subscription['id'],
        accountId: ids.acctFresh,
        planId: ids.planFree,
        createdByUserId: ids.userFarmer,
      });

      await store.subscriptions.save(born, subscriptionStarted(born));
      expect(await store.subscriptions.findByAccount(ids.acctFresh)).toEqual(
        born,
      );

      // levers replace the mutable facts on the same account
      const paid = { ...born, paidThroughAt: '2026-12-31T00:00:00.000Z' };
      await store.subscriptions.save(paid, subscriptionStarted(paid));
      expect(
        (await store.subscriptions.findByAccount(ids.acctFresh))?.paidThroughAt,
      ).toBe('2026-12-31T00:00:00.000Z');

      // a duplicate birth (new id, same account) keeps ONE row and the
      // original identity facts; mutable facts take the incoming values
      const dupe = contractSubscription({
        id: crypto.randomUUID() as Subscription['id'],
        accountId: ids.acctFresh,
        planId: ids.planPro,
        createdByUserId: ids.userMember,
      });
      await store.subscriptions.save(dupe, subscriptionStarted(dupe));
      const current = await store.subscriptions.findByAccount(ids.acctFresh);
      expect(current?.id).toBe(born.id);
      expect(current?.createdByUserId).toBe(ids.userFarmer);
      expect(current?.planId).toBe(ids.planPro);
      expect(await store.plans.countSubscribers(ids.planFree)).toBe(2);
      expect((await store.events()).map((e) => e.type)).toEqual([
        'subscription.started',
        'subscription.started',
        'subscription.started',
      ]);
    });

    it('answers hasTrialConsumedByUser from the creating identity', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));
      expect(
        await store.subscriptions.hasTrialConsumedByUser(ids.userOwner),
      ).toBe(true);
      expect(
        await store.subscriptions.hasTrialConsumedByUser(ids.userMember),
      ).toBe(false);
    });

    it('records trial expiry exactly once: two observers, one event', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));
      const event: BillingEvent = {
        type: 'subscription.trial-expired',
        subscriptionId: ids.subLone,
        accountId: ids.acctLone,
        trialEndsAt: '2026-08-01T00:00:00.000Z',
        occurredAt: NOW,
      };

      expect(
        await store.subscriptions.recordTrialExpired(ids.subLone, event),
      ).toBe(true);
      expect(
        await store.subscriptions.recordTrialExpired(ids.subLone, event),
      ).toBe(false);
      expect(
        await store.subscriptions.recordTrialExpired(
          crypto.randomUUID(),
          event,
        ),
      ).toBe(false);
      expect(
        (await store.events()).filter(
          (e) => e.type === 'subscription.trial-expired',
        ),
      ).toHaveLength(1);
    });

    it('counts members and owned-orgs-per-plan for the entitlement guards', async () => {
      const ids = makeBillingContractIds();
      const store = await makeStore(billingContractSeed(ids));

      expect(await store.usage.countMembers(ids.acctLone)).toBe(1);
      expect(await store.usage.countMembers(ids.acctCrowded)).toBe(4);
      expect(await store.usage.countMembers(ids.acctPro)).toBe(2);

      // ADR-0016 D2: owned orgs, counted per plan key
      expect(
        await store.usage.countOwnedOrgsOnPlan(ids.userOwner, 'free'),
      ).toBe(1);
      expect(await store.usage.countOwnedOrgsOnPlan(ids.userOwner, 'pro')).toBe(
        1,
      );
      expect(
        await store.usage.countOwnedOrgsOnPlan(ids.userFarmer, 'free'),
      ).toBe(1);
      // plain membership never counts toward the ownership limit
      expect(
        await store.usage.countOwnedOrgsOnPlan(ids.userMember, 'free'),
      ).toBe(0);
    });
  });
};
