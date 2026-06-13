import { accessPresetPermissions } from '@acme/domain';
import { POSTGRES_TEST_URL } from '../testing/postgres-test-env';
import { applyPostgresAccessSeed } from './postgres/seed';

/**
 * Fixtures for the RLS spec: two users on two accounts (A = support staff,
 * B = customer) plus an already-expired grant from A onto B's account.
 */
export const rlsIds = {
  userA: crypto.randomUUID(),
  userB: crypto.randomUUID(),
  acctA: crypto.randomUUID(),
  acctB: crypto.randomUUID(),
  membershipA: crypto.randomUUID(),
  membershipB: crypto.randomUUID(),
  sessionA: crypto.randomUUID(),
  sessionB: crypto.randomUUID(),
  grantA: crypto.randomUUID(),
};

export const seedRlsWorld = () =>
  applyPostgresAccessSeed(POSTGRES_TEST_URL, {
    accounts: [{ id: rlsIds.acctA }, { id: rlsIds.acctB }],
    customers: [
      {
        accountId: rlsIds.acctB,
        displayName: 'Cliente B',
        email: 'b@example.com',
      },
    ],
    memberships: [
      {
        id: rlsIds.membershipA,
        userId: rlsIds.userA,
        accountId: rlsIds.acctA,
        permissions: accessPresetPermissions('support'),
      },
      {
        id: rlsIds.membershipB,
        userId: rlsIds.userB,
        accountId: rlsIds.acctB,
        permissions: accessPresetPermissions('customer'),
      },
    ],
    sessions: [
      {
        id: rlsIds.sessionA,
        membershipId: rlsIds.membershipA,
        expiresAt: '2026-12-31T00:00:00.000Z',
      },
      {
        id: rlsIds.sessionB,
        membershipId: rlsIds.membershipB,
        expiresAt: '2026-12-31T00:00:00.000Z',
      },
    ],
    grants: [
      {
        id: rlsIds.grantA as never,
        kind: 'impersonation',
        membershipId: rlsIds.membershipA as never,
        targetAccountId: rlsIds.acctB as never,
        actions: ['customer.read'],
        reason: 'ticket #7',
        createdAt: '2026-06-09T10:00:00.000Z',
        expiresAt: '2026-06-09T10:30:00.000Z',
        revokedAt: null,
        expiryRecordedAt: null,
      },
    ],
  });
