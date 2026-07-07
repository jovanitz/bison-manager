import { accessPresetPermissions } from '@acme/domain';
import type { SessionId } from '@acme/domain';
import type {
  IdentityOnboardingRepository,
  NewIdentityMembership,
} from '@acme/application';
import {
  ACCESS_CONTRACT_NOW as NOW,
  contractSubscriptionBirth,
} from '../access-store-fixtures';
import type {
  AccessContractIds,
  AccessStorePorts,
} from '../access-store-fixtures';

/** Birth facts against the world's seeded default plan (FK-valid). */
export const customerBirth = async (
  store: AccessStorePorts,
  membership: NewIdentityMembership,
) => {
  const plan = await store.billing.defaultPlan();
  if (!plan) throw new Error('contract setup: no default plan seeded');
  const birth = contractSubscriptionBirth({
    accountId: membership.accountId,
    userId: membership.userId,
    planId: plan.id,
  });
  await store.onboarding.createCustomerMembership(
    membership,
    birth.subscription,
    birth.event,
  );
  return birth;
};

const EXPIRES = '2026-07-09T12:00:00.000Z';

export const newMembership = (
  ids: AccessContractIds,
  preset: 'owner' | 'customer',
): NewIdentityMembership => ({
  membershipId: crypto.randomUUID() as NewIdentityMembership['membershipId'],
  accountId: crypto.randomUUID() as NewIdentityMembership['accountId'],
  userId: ids.userNew,
  email: 'new@example.com',
  displayName: preset === 'owner' ? 'Owner' : 'New Customer',
  permissions: accessPresetPermissions(preset),
  occurredAt: NOW,
});

export const registerSession = async (
  onboarding: IdentityOnboardingRepository,
  membership: NewIdentityMembership,
): Promise<SessionId> => {
  const sessionId = crypto.randomUUID() as SessionId;
  await onboarding.createSession(
    {
      sessionId,
      membershipId: membership.membershipId,
      createdAt: NOW,
      expiresAt: EXPIRES,
      context: { userAgent: 'contract-test', ipAddress: '203.0.113.7' },
    },
    {
      type: 'login.succeeded',
      userId: membership.userId,
      sessionId,
      occurredAt: NOW,
    },
  );
  return sessionId;
};
