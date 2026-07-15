import { ok } from '@acme/shared';
import type {
  AccountAdminGateway,
  AuditGateway,
  SessionsGateway,
  SettingsGateway,
} from '@acme/application';

/** Test doubles for the staff-dashboard admin gateways (spec-only). */
export const mockAccountAdmin = (
  overrides: Partial<AccountAdminGateway> = {},
): AccountAdminGateway => ({
  disable: async () => ok(undefined),
  enable: async () => ok(undefined),
  promote: async () => ok(undefined),
  demote: async () => ok(undefined),
  ...overrides,
});

export const testAuditEntries = [
  {
    id: 'evt-1',
    event: { type: 'account.disabled', occurredAt: '2026-06-23T10:00:00.000Z' },
  },
];

export const mockAudit = (
  overrides: Partial<AuditGateway> = {},
): AuditGateway => ({
  list: async () => ok(testAuditEntries),
  ...overrides,
});

export const testSessions = [
  {
    id: 'sess-1',
    status: 'active',
    createdAt: '2026-06-23T08:00:00.000Z',
    lastSeenAt: '2026-06-23T09:00:00.000Z',
    expiresAt: '2026-06-24T08:00:00.000Z',
    userAgent: 'Chrome',
    lastIp: 'last-ip',
  },
];

export const mockSessions = (
  overrides: Partial<SessionsGateway> = {},
): SessionsGateway => ({
  list: async () => ok(testSessions),
  revoke: async () => ok(undefined),
  revokeAll: async () => ok(undefined),
  ...overrides,
});

export const testPolicies = {
  customer: { idleTtlMs: 86_400_000, maxLifetimeMs: 259_200_000 },
  staff: { idleTtlMs: 1_800_000, maxLifetimeMs: 43_200_000 },
};

export const mockSettings = (
  overrides: Partial<SettingsGateway> = {},
): SettingsGateway => ({
  read: async () => ok({ policies: testPolicies, version: 1 }),
  update: async () => ok(undefined),
  ...overrides,
});
