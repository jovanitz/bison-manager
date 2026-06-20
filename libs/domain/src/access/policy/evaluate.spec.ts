import { describe, expect, it } from 'vitest';
import type { AccessActor } from '../actor';
import type { AccessGrant } from '../grant/grant';
import type { AccessPermission, AccessResource } from '../permission';
import { accessPresetPermissions } from '../presets';
import type { AccountId } from '../value-objects';
import { evaluateAccessPolicy } from './evaluate';

const NOW = '2026-06-09T12:00:00.000Z';
const LATER = '2026-06-09T12:30:00.000Z';
const EARLIER = '2026-06-09T11:00:00.000Z';

const account = (id: string): AccountId => id as AccountId;

const actorWith = (overrides: {
  accountId?: string;
  accountStatus?: AccessActor['accountStatus'];
  sessionStatus?: AccessActor['session']['status'];
  sessionExpiresAt?: string;
  permissions?: ReadonlyArray<AccessPermission>;
  grants?: ReadonlyArray<AccessGrant>;
  blocked?: boolean;
  isRoot?: boolean;
  isAccountOwner?: boolean;
}): AccessActor => ({
  membership: {
    id: 'membership-1' as AccessActor['membership']['id'],
    userId: 'user-1' as AccessActor['membership']['userId'],
    accountId: account(overrides.accountId ?? 'acct-own'),
  },
  accountStatus: overrides.accountStatus ?? 'active',
  accountKind: 'staff',
  isRoot: overrides.isRoot ?? false,
  isAccountOwner: overrides.isAccountOwner ?? false,
  blocked: overrides.blocked ?? false,
  session: {
    id: 'session-1' as AccessActor['session']['id'],
    status: overrides.sessionStatus ?? 'active',
    expiresAt: overrides.sessionExpiresAt ?? LATER,
    createdAt: EARLIER,
  },
  permissions: overrides.permissions ?? [],
  grants: overrides.grants ?? [],
});

const grantOn = (
  targetAccountId: string,
  overrides: Partial<AccessGrant> = {},
): AccessGrant => ({
  id: 'grant-1' as AccessGrant['id'],
  kind: 'impersonation',
  membershipId: 'membership-1' as AccessGrant['membershipId'],
  targetAccountId: account(targetAccountId),
  actions: ['customer.read'],
  reason: 'ticket #42',
  createdAt: EARLIER,
  expiresAt: LATER,
  revokedAt: null,
  expiryRecordedAt: null,
  ...overrides,
});

const resource = (accountId: string | null): AccessResource => ({
  accountId: accountId === null ? null : account(accountId),
});

describe('evaluateAccessPolicy', () => {
  it('denies by default when the actor holds nothing', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({}),
      action: 'customer.read',
      resource: resource('acct-own'),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-permitted' });
  });

  it('allows an owner-preset actor to disable any account', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({ permissions: accessPresetPermissions('owner') }),
      action: 'account.disable',
      resource: resource('acct-other'),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: true, source: 'permission' });
  });

  it('scopes customer-preset actors to their own account', () => {
    const customer = actorWith({
      permissions: accessPresetPermissions('customer'),
    });
    const own = evaluateAccessPolicy({
      actor: customer,
      action: 'customer.read',
      resource: resource('acct-own'),
      now: NOW,
    });
    const other = evaluateAccessPolicy({
      actor: customer,
      action: 'customer.read',
      resource: resource('acct-other'),
      now: NOW,
    });
    expect(own.allowed).toBe(true);
    expect(other).toEqual({ allowed: false, reason: 'not-permitted' });
  });

  it('never matches an own-scoped permission against a system resource', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({ permissions: accessPresetPermissions('customer') }),
      action: 'customer.read',
      resource: resource(null),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
  });

  it('denies every operation for a blocked actor, even with full permissions', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({
        blocked: true,
        permissions: accessPresetPermissions('owner'),
      }),
      action: 'audit.read',
      resource: resource(null),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'blocked' });
  });

  it('denies everything when the account is disabled, even for owners', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({
        accountStatus: 'disabled',
        permissions: accessPresetPermissions('owner'),
      }),
      action: 'audit.read',
      resource: resource(null),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'account-disabled' });
  });

  it('denies everything on a revoked session', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({
        sessionStatus: 'revoked',
        permissions: accessPresetPermissions('owner'),
      }),
      action: 'audit.read',
      resource: resource(null),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'session-revoked' });
  });

  it('denies everything on an expired session', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({
        sessionExpiresAt: EARLIER,
        permissions: accessPresetPermissions('owner'),
      }),
      action: 'audit.read',
      resource: resource(null),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'session-expired' });
  });

  it('denies support customer.read without an impersonation grant', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({ permissions: accessPresetPermissions('support') }),
      action: 'customer.read',
      resource: resource('acct-customer'),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-permitted' });
  });

  it('allows customer.read through an active grant, only on its target', () => {
    const support = actorWith({
      permissions: accessPresetPermissions('support'),
      grants: [grantOn('acct-customer')],
    });
    const target = evaluateAccessPolicy({
      actor: support,
      action: 'customer.read',
      resource: resource('acct-customer'),
      now: NOW,
    });
    const other = evaluateAccessPolicy({
      actor: support,
      action: 'customer.read',
      resource: resource('acct-unrelated'),
      now: NOW,
    });
    expect(target).toEqual({
      allowed: true,
      source: 'grant',
      grantId: 'grant-1',
    });
    expect(other).toEqual({ allowed: false, reason: 'not-permitted' });
  });

  it('never authorizes actions outside the grant allowlist', () => {
    const decision = evaluateAccessPolicy({
      actor: actorWith({ grants: [grantOn('acct-customer')] }),
      action: 'account.disable',
      resource: resource('acct-customer'),
      now: NOW,
    });
    expect(decision.allowed).toBe(false);
  });

  it('ignores expired and revoked grants', () => {
    const expired = grantOn('acct-customer', { expiresAt: EARLIER });
    const revoked = grantOn('acct-customer', { revokedAt: EARLIER });
    for (const grant of [expired, revoked]) {
      const decision = evaluateAccessPolicy({
        actor: actorWith({ grants: [grant] }),
        action: 'customer.read',
        resource: resource('acct-customer'),
        now: NOW,
      });
      expect(decision).toEqual({ allowed: false, reason: 'not-permitted' });
    }
  });
});
