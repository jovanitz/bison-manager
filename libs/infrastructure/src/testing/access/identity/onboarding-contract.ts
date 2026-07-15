import { describe, expect, it } from 'vitest';
import { accessPresetPermissions } from '@acme/domain';
import type { SessionId, UserId } from '@acme/domain';
import type { InMemoryAccessSeed } from '../../../access/in-memory/access-seed';
import {
  ACCESS_CONTRACT_NOW as NOW,
  ACCESS_CONTRACT_TRIAL_ENDS,
  accessContractSeed,
  makeAccessContractIds,
} from '../access-store-fixtures';
import type { AccessStorePorts } from '../access-store-fixtures';
import { customerBirth, newMembership, registerSession } from './fixtures';
import { identityInvitationContract } from './invitation-contract';

/**
 * Contract for the identity-onboarding port: linking verified identities to
 * memberships, the owner-bootstrap probe, and session registration. Same
 * rules as the access-store contract — `makeStore` isolates per call.
 */
export const identityOnboardingContract = (
  name: string,
  makeStore: (
    seed: InMemoryAccessSeed,
  ) => AccessStorePorts | Promise<AccessStorePorts>,
): void => {
  describe(`IdentityOnboarding contract: ${name}`, () => {
    it('finds memberships by user and sees seeded sessions', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      expect(
        await store.onboarding.findMembershipByUser(ids.userSupport),
      ).toEqual({
        membershipId: ids.membershipSupport,
        accountId: ids.acctSupport,
        accountKind: 'staff',
      });
      expect(
        await store.onboarding.findMembershipByUser(ids.userNew),
      ).toBeNull();
      expect(await store.onboarding.sessionExists(ids.sessionSupport)).toBe(
        true,
      );
      expect(
        await store.onboarding.sessionExists(crypto.randomUUID() as SessionId),
      ).toBe(false);
      expect(
        await store.onboarding.findMembershipByUser('nope' as UserId),
      ).toBeNull();
    });

    it('detects root admins only when someone can administer permissions', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      // support preset cannot administer permissions
      expect(await store.onboarding.rootAdminExists()).toBe(false);

      const owner = newMembership(ids, 'owner');
      await store.onboarding.createOwnerMembership(owner, {
        type: 'owner.bootstrapped',
        membershipId: owner.membershipId,
        userId: owner.userId,
        occurredAt: NOW,
      });
      expect(await store.onboarding.rootAdminExists()).toBe(true);
      expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
        'owner.bootstrapped',
      ]);
      // owner (staff) account must never surface in the customer directory
      expect(await store.customers.read(owner.accountId)).toBeNull();
    });

    it('provisions customers into the directory as their account owner', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const customer = newMembership(ids, 'customer');
      await customerBirth(store, customer);

      expect(await store.onboarding.rootAdminExists()).toBe(false);
      expect(await store.customers.read(customer.accountId)).toMatchObject({
        displayName: 'New Customer',
        email: 'new@example.com',
      });
      expect(await store.onboarding.findMembershipByUser(ids.userNew)).toEqual({
        membershipId: customer.membershipId,
        accountId: customer.accountId,
        accountKind: 'customer',
      });
      // ADR-0011: creating your own org makes you its owner (own-scope bypass).
      const session = await registerSession(store.onboarding, customer);
      expect(
        (await store.actors.findActorBySession(session))?.isAccountOwner,
      ).toBe(true);
    });

    it('births the subscription + its started event with the org (ADR-0016)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const customer = newMembership(ids, 'customer');
      const birth = await customerBirth(store, customer);

      // the subscription facts are readable from the billing store…
      const sub = await store.billing.subscriptions.findByAccount(
        customer.accountId,
      );
      expect(sub).toMatchObject({
        id: birth.subscription.id,
        accountId: customer.accountId,
        createdByUserId: customer.userId,
        trialEndsAt: ACCESS_CONTRACT_TRIAL_ENDS,
        paidThroughAt: null,
        canceledAt: null,
      });
      // …and the birth event landed on billing's own audit stream.
      expect(
        (await store.billing.events()).map((event) => event.type),
      ).toContain('subscription.started');
    });

    it('the owner bootstrap (staff org) is subscription-free (ADR-0016)', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const owner = newMembership(ids, 'owner');
      await store.onboarding.createOwnerMembership(owner, {
        type: 'owner.bootstrapped',
        membershipId: owner.membershipId,
        userId: owner.userId,
        occurredAt: NOW,
      });
      expect(
        await store.billing.subscriptions.findByAccount(owner.accountId),
      ).toBeNull();
      expect(await store.billing.events()).toEqual([]);
    });

    it('lists only the live sessions of a membership', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const owner = newMembership(ids, 'owner');
      await store.onboarding.createOwnerMembership(owner, {
        type: 'owner.bootstrapped',
        membershipId: owner.membershipId,
        userId: owner.userId,
        occurredAt: NOW,
      });
      const first = await registerSession(store.onboarding, owner);
      const second = await registerSession(store.onboarding, owner);

      const active = await store.onboarding.listActiveSessions(
        owner.membershipId,
        NOW,
      );
      expect(active.map((s) => s.sessionId).sort()).toEqual(
        [first, second].sort(),
      );
      // a session past its expiry is not "active"
      const afterExpiry = await store.onboarding.listActiveSessions(
        owner.membershipId,
        '2026-08-01T00:00:00.000Z',
      );
      expect(afterExpiry).toHaveLength(0);
    });

    it('registers a session + login.succeeded that the actor reader honours', async () => {
      const ids = makeAccessContractIds();
      const store = await makeStore(accessContractSeed(ids));
      const owner = newMembership(ids, 'owner');
      await store.onboarding.createOwnerMembership(owner, {
        type: 'owner.bootstrapped',
        membershipId: owner.membershipId,
        userId: owner.userId,
        occurredAt: NOW,
      });

      const sessionId = await registerSession(store.onboarding, owner);

      expect(await store.onboarding.sessionExists(sessionId)).toBe(true);
      const actor = await store.actors.findActorBySession(sessionId);
      expect(actor?.membership.id).toBe(owner.membershipId);
      expect(actor?.session.status).toBe('active');
      expect(actor?.permissions).toEqual(accessPresetPermissions('owner'));
      expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
        'owner.bootstrapped',
        'login.succeeded',
      ]);
    });
  });

  identityInvitationContract(name, makeStore);
};
