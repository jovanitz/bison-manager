import { accessPresetPermissions } from '@acme/domain';
import type { AccountId, InvitationId, MembershipId } from '@acme/domain';
import type { PendingAccessInvitation } from '../../access-invitations/ports';
import type { IdentityMembershipSnapshot } from '../ports';
import type { makeIdentityWorld } from '../testing';
import { IDENTITY_TEST_CONTEXT } from '../testing';
import { makeIdentityUseCases } from '../use-cases';

/** Shared fixtures for the registerIdentitySession specs (spec-only). */
export const CUSTOMER_EXPIRES = '2026-06-11T12:00:00.000Z'; // NOW + 24 h idle
export const STAFF_EXPIRES = '2026-06-10T12:30:00.000Z'; // NOW + 30 min idle

export const knownCustomerMembership: Record<
  string,
  IdentityMembershipSnapshot
> = {
  'user-1': {
    membershipId: 'membership-9' as MembershipId,
    accountId: 'acct-9' as AccountId,
    accountKind: 'customer',
  },
};

export const pendingInvite = (
  over?: Partial<PendingAccessInvitation>,
): PendingAccessInvitation => ({
  invitationId: 'inv-1' as InvitationId,
  accountId: 'acct-owner' as AccountId,
  accountKind: 'staff',
  permissions: accessPresetPermissions('support'),
  roleIds: [],
  seatBlockedAt: null,
  ...over,
});

export const register = (
  world: ReturnType<typeof makeIdentityWorld>,
  email: string | null,
) =>
  makeIdentityUseCases(world.deps).registerIdentitySession({
    userId: 'user-1',
    sessionId: 'session-1',
    email,
    context: IDENTITY_TEST_CONTEXT,
  });
