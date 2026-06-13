import { accessPresetPermissions } from '@acme/domain';
import type { InMemoryAccessSeed } from '@acme/infrastructure';

/**
 * The standard phase-3 world for the dev server and the contract tests: one
 * account per preset, one session each (the bearer token IS the session id —
 * `Bearer session-owner` etc.), a pre-revoked customer session, and a customer
 * directory holding ONLY the customer account (a staff account listed there
 * would become impersonable). Phase 4 replaces this with real Supabase rows.
 */
const hourAgo = (): string => new Date(Date.now() - 3_600_000).toISOString();

export const seedWorld = (config: {
  readonly sessionExpiresAt: string;
  /** Login instant of the seeded sessions (defaults to one hour ago). */
  readonly sessionCreatedAt?: string;
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
      createdAt: config.sessionCreatedAt ?? hourAgo(),
    },
    {
      id: 'session-support',
      membershipId: 'membership-support',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
    },
    {
      id: 'session-customer',
      membershipId: 'membership-customer',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
    },
    {
      id: 'session-revoked',
      membershipId: 'membership-customer',
      expiresAt: config.sessionExpiresAt,
      createdAt: config.sessionCreatedAt ?? hourAgo(),
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
