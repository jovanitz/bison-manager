import { accessPresetPermissions } from '@acme/domain';
import type { InMemoryAccessSeed } from '@acme/infrastructure';

/**
 * The standard phase-3 world for the dev server and the contract tests: one
 * account per preset, one session each (the bearer token IS the session id —
 * `Bearer session-owner` etc.), a pre-revoked customer session, and a customer
 * directory holding ONLY the customer account (a staff account listed there
 * would become impersonable). Phase 4 replaces this with real Supabase rows.
 */
export const seedWorld = (config: {
  readonly sessionExpiresAt: string;
}): InMemoryAccessSeed => ({
  accounts: [
    { id: 'acct-owner' },
    { id: 'acct-support' },
    { id: 'acct-customer' },
  ],
  memberships: [
    {
      id: 'membership-owner',
      userId: 'user-owner',
      accountId: 'acct-owner',
      permissions: accessPresetPermissions('owner'),
    },
    {
      id: 'membership-support',
      userId: 'user-support',
      accountId: 'acct-support',
      permissions: accessPresetPermissions('support'),
    },
    {
      id: 'membership-customer',
      userId: 'user-customer',
      accountId: 'acct-customer',
      permissions: accessPresetPermissions('customer'),
    },
  ],
  sessions: [
    {
      id: 'session-owner',
      membershipId: 'membership-owner',
      expiresAt: config.sessionExpiresAt,
    },
    {
      id: 'session-support',
      membershipId: 'membership-support',
      expiresAt: config.sessionExpiresAt,
    },
    {
      id: 'session-customer',
      membershipId: 'membership-customer',
      expiresAt: config.sessionExpiresAt,
    },
    {
      id: 'session-revoked',
      membershipId: 'membership-customer',
      expiresAt: config.sessionExpiresAt,
      status: 'revoked',
    },
  ],
  customers: [
    {
      accountId: 'acct-customer',
      displayName: 'Casa Pampa',
      email: 'ops@casapampa.example',
    },
  ],
});
