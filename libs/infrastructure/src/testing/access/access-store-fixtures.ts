import {
  accessPresetPermissions,
  createImpersonationGrant,
} from '@acme/domain';
import type {
  AccessGrant,
  AccountId,
  MembershipId,
  SessionId,
  UserId,
} from '@acme/domain';
import type {
  AccessActorReader,
  AccessAdminRepository,
  AccessAuditTrail,
  AccessGrantExpiryRecorder,
  AccessGrantRepository,
  AccessInvitationStore,
  AccessMemberDirectory,
  AccessSessionActivityRecorder,
  AccessSessionPolicyStore,
  CustomerDirectory,
  IdentityOnboardingRepository,
} from '@acme/application';
import type { InMemoryAccessSeed } from '../../access/in-memory-access-seed';

/**
 * Shared fixtures for the access-store contract suite. Ids are random UUIDs
 * so the same fixtures run against uuid-typed Postgres columns and the
 * in-memory maps alike.
 */
export type AccessStorePorts = {
  readonly actors: AccessActorReader;
  readonly grantExpiry: AccessGrantExpiryRecorder;
  readonly auditTrail: AccessAuditTrail;
  readonly admin: AccessAdminRepository;
  readonly grants: AccessGrantRepository;
  readonly customers: CustomerDirectory;
  readonly onboarding: IdentityOnboardingRepository;
  readonly sessionPolicies: AccessSessionPolicyStore;
  readonly sessionActivity: AccessSessionActivityRecorder;
  readonly invitations: AccessInvitationStore;
  readonly members: AccessMemberDirectory;
};

export const ACCESS_CONTRACT_NOW = '2026-06-09T12:00:00.000Z';
export const ACCESS_CONTRACT_SESSION_EXPIRES = '2026-06-09T18:00:00.000Z';

export const makeAccessContractIds = () => ({
  acctSupport: crypto.randomUUID() as AccountId,
  acctCustomer: crypto.randomUUID() as AccountId,
  membershipSupport: crypto.randomUUID() as MembershipId,
  sessionSupport: crypto.randomUUID() as SessionId,
  grant: crypto.randomUUID() as AccessGrant['id'],
  userSupport: crypto.randomUUID() as UserId,
  /** Exists in the auth provider but holds no membership yet (onboarding). */
  userNew: crypto.randomUUID() as UserId,
});

export type AccessContractIds = ReturnType<typeof makeAccessContractIds>;

export const accessContractSeed = (
  ids: AccessContractIds,
): InMemoryAccessSeed => ({
  accounts: [{ id: ids.acctSupport }, { id: ids.acctCustomer }],
  memberships: [
    {
      id: ids.membershipSupport,
      userId: ids.userSupport,
      accountId: ids.acctSupport,
      permissions: accessPresetPermissions('support'),
    },
  ],
  users: [{ id: ids.userNew }],
  sessions: [
    {
      id: ids.sessionSupport,
      membershipId: ids.membershipSupport,
      expiresAt: ACCESS_CONTRACT_SESSION_EXPIRES,
    },
  ],
  customers: [
    {
      accountId: ids.acctCustomer,
      displayName: 'Casa Pampa',
      email: 'ops@casapampa.example',
    },
  ],
});

export const accessContractGrant = (
  ids: AccessContractIds,
  occurredAt: string,
  expiresAt: string,
): AccessGrant => {
  const created = createImpersonationGrant({
    id: ids.grant,
    membershipId: ids.membershipSupport,
    targetAccountId: ids.acctCustomer,
    reason: 'ticket #42',
    occurredAt,
    expiresAt,
  });
  if (!created.ok) throw new Error('setup');
  return created.value.grant;
};
