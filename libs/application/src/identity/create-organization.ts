import {
  type Clock,
  type IdGenerator,
  type Result,
  type TaggedError,
  defineError,
  err,
  ok,
} from '@acme/shared';
import { accessPresetPermissions, startSubscription } from '@acme/domain';
import type {
  AccountId,
  BillingSubscriptionStarted,
  MembershipId,
  Plan,
  UserId,
} from '@acme/domain';
import { defaultPlanMissing } from '../billing-subscriptions/errors';
import type { BillingSubscriptionsUseCaseError } from '../billing-subscriptions/errors';
import type { EntitlementGuards } from '../billing-subscriptions/guards';
import type { SubscriptionStore } from '../billing-subscriptions/ports';
import type { IdentityOnboardingRepository } from './ports';

export const invalidOrgName = defineError('app/invalid-org-name');

/**
 * Billing joins the union (ADR-0016 Decision 4): `app/plan-limit-exceeded`
 * (ownership limit reached) and `app/default-plan-missing` (fail closed,
 * never "no plan = unlimited") are the enforcement tags.
 */
export type CreateOrganizationError =
  | TaggedError<'app/invalid-org-name'>
  | BillingSubscriptionsUseCaseError;

export type CreateOrganizationDeps = {
  readonly onboarding: Pick<
    IdentityOnboardingRepository,
    'createCustomerMembership'
  >;
  /**
   * Seed the org's default roles (ADR-0012). Loosely typed to avoid coupling
   * identity to the roles error type; idempotent and best-effort — a failure
   * leaves the owner (own-scope bypass) able to install/reset later.
   */
  readonly installDefaults: (accountId: AccountId) => Promise<unknown>;
  /**
   * The billing birth facts (ADR-0016): the pre-actor ownership-limit guard,
   * the once-ever-per-identity trial probe, and the default plan the new org
   * is born on.
   */
  readonly billing: {
    readonly guardOrgCreation: EntitlementGuards['guardOrgCreation'];
    readonly hasTrialConsumedByUser: SubscriptionStore['hasTrialConsumedByUser'];
    readonly defaultPlan: () => Promise<Plan | null>;
  };
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

/**
 * Identity-level: a signed-in but ORG-LESS user creates their own organization
 * and becomes its admin (`customer-admin`). Runs off the verified identity
 * (userId/email from the JWT) — there is no actor yet, by definition. After
 * this the user has a membership, so the normal actor path resolves on the next
 * request. Enforcement (ADR-0016 Decision 4): the ownership limit is checked
 * against the default plan first, then the org + membership + subscription are
 * born in ONE adapter transaction — the trial frozen at subscribe, already
 * consumed if this identity ever created an org before (anti trial-farming).
 */
export const makeCreateOrganization =
  (deps: CreateOrganizationDeps) =>
  async (input: {
    readonly userId: string;
    readonly email: string | null;
    readonly name: string;
  }): Promise<
    Result<
      { readonly accountId: string; readonly membershipId: string },
      CreateOrganizationError
    >
  > => {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 200) {
      return err(invalidOrgName('An organization name is required.'));
    }
    const guarded = await deps.billing.guardOrgCreation({
      userId: input.userId,
    });
    if (!guarded.ok) return err(guarded.error);

    // One trial per creating identity (ADR-0016 D3): a second org is born
    // with its trial already consumed (trialEndsAt = startedAt).
    const trialAlreadyUsed = await deps.billing.hasTrialConsumedByUser(
      input.userId,
    );
    const plan = await deps.billing.defaultPlan();
    if (!plan) {
      return err(defaultPlanMissing('No default plan for new orgs is set.'));
    }

    const occurredAt = deps.clock.now().toISOString();
    const membershipId = deps.ids.next() as MembershipId;
    const accountId = deps.ids.next() as AccountId;
    const subscription = startSubscription(
      { accountId, plan, createdByUserId: input.userId, trialAlreadyUsed },
      { ids: () => deps.ids.next(), now: occurredAt },
    );
    const started: BillingSubscriptionStarted = {
      type: 'subscription.started',
      subscriptionId: subscription.id,
      accountId: subscription.accountId,
      planId: subscription.planId,
      createdByUserId: subscription.createdByUserId,
      trialEndsAt: subscription.trialEndsAt,
      occurredAt,
    };
    await deps.onboarding.createCustomerMembership(
      {
        membershipId,
        accountId,
        userId: input.userId as UserId,
        email: input.email,
        displayName: name,
        permissions: accessPresetPermissions('customer-admin'),
        occurredAt,
      },
      subscription,
      started,
    );
    // ADR-0012: a new org starts "organized" with its own resettable defaults.
    await deps.installDefaults(accountId);
    return ok({ accountId, membershipId });
  };

export type CreateOrganizationUseCases = {
  readonly createOrganization: ReturnType<typeof makeCreateOrganization>;
};

export const makeCreateOrganizationUseCases = (
  deps: CreateOrganizationDeps,
): CreateOrganizationUseCases => ({
  createOrganization: makeCreateOrganization(deps),
});
