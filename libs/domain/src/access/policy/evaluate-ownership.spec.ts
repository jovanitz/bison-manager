import { describe, expect, it } from 'vitest';
import type { AccessActor } from '../actor';
import type { AccessResource } from '../permission';
import type { AccountId } from '../value-objects';
import { evaluateAccessPolicy } from './evaluate';

/**
 * ADR-0011: the ownership bypass. Root and account-owners derive authority from
 * an identity flag (not a permission list), so they never go stale — but the
 * fail-closed gates still beat them, and grant-only actions (customer data) stay
 * behind an audited grant even for root.
 */
const NOW = '2026-06-09T12:00:00.000Z';
const LATER = '2026-06-09T12:30:00.000Z';
const EARLIER = '2026-06-09T11:00:00.000Z';

const actor = (o: {
  isRoot?: boolean;
  isAccountOwner?: boolean;
  accountStatus?: AccessActor['accountStatus'];
  sessionStatus?: AccessActor['session']['status'];
  expiresAt?: string;
  blocked?: boolean;
}): AccessActor => ({
  membership: {
    id: 'm-1' as AccessActor['membership']['id'],
    userId: 'u-1' as AccessActor['membership']['userId'],
    accountId: 'acct-own' as AccountId,
  },
  accountStatus: o.accountStatus ?? 'active',
  accountKind: 'staff',
  isRoot: o.isRoot ?? false,
  isAccountOwner: o.isAccountOwner ?? false,
  blocked: o.blocked ?? false,
  session: {
    id: 's-1' as AccessActor['session']['id'],
    status: o.sessionStatus ?? 'active',
    expiresAt: o.expiresAt ?? LATER,
    createdAt: EARLIER,
  },
  permissions: [],
  grants: [],
});

const res = (accountId: string | null): AccessResource => ({
  accountId: accountId === null ? null : (accountId as AccountId),
});

describe('evaluateAccessPolicy — ownership bypass (ADR-0011)', () => {
  it('root is authorized for any non-grant-only action, on any account or system', () => {
    const root = actor({ isRoot: true });
    for (const r of [res('acct-other'), res(null)]) {
      const decision = evaluateAccessPolicy({
        actor: root,
        action: 'account.disable',
        resource: r,
        now: NOW,
      });
      expect(decision).toEqual({ allowed: true, source: 'root' });
    }
  });

  it('root STILL needs a grant for customer data (grant-only stays audited)', () => {
    const decision = evaluateAccessPolicy({
      actor: actor({ isRoot: true }),
      action: 'customer.read',
      resource: res('acct-customer'),
      now: NOW,
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-permitted' });
  });

  it('the fail-closed gates beat the bypass (disabled / expired / blocked root)', () => {
    const cases = [
      { o: { accountStatus: 'disabled' as const }, reason: 'account-disabled' },
      { o: { expiresAt: EARLIER }, reason: 'session-expired' },
      { o: { blocked: true }, reason: 'blocked' },
    ] as const;
    for (const c of cases) {
      const decision = evaluateAccessPolicy({
        actor: actor({ isRoot: true, ...c.o }),
        action: 'audit.read',
        resource: res(null),
        now: NOW,
      });
      expect(decision).toEqual({ allowed: false, reason: c.reason });
    }
  });

  it('an account owner is authorized on its OWN account only', () => {
    const owner = actor({ isAccountOwner: true });
    const own = evaluateAccessPolicy({
      actor: owner,
      action: 'members.invite',
      resource: res('acct-own'),
      now: NOW,
    });
    const other = evaluateAccessPolicy({
      actor: owner,
      action: 'members.invite',
      resource: res('acct-other'),
      now: NOW,
    });
    const system = evaluateAccessPolicy({
      actor: owner,
      action: 'staff.read',
      resource: res(null),
      now: NOW,
    });
    expect(own).toEqual({ allowed: true, source: 'owner' });
    expect(other).toEqual({ allowed: false, reason: 'not-permitted' });
    expect(system).toEqual({ allowed: false, reason: 'not-permitted' });
  });

  it('an account owner CANNOT promote/disable/enable its own account (privilege escalation)', () => {
    // The escalation the adversarial review found: a self-signup org creator is
    // `isAccountOwner` on their own account, so without this the ownership bypass
    // would let them `account.promote` themselves to staff — and a staff account
    // escapes the customer-coherence guard, so they could then grant themselves
    // any staff action. Account-lifecycle actions must fall through to the
    // permission check, which a non-staff owner fails.
    const owner = actor({ isAccountOwner: true });
    for (const action of [
      'account.promote',
      'account.disable',
      'account.enable',
    ] as const) {
      expect(
        evaluateAccessPolicy({
          actor: owner,
          action,
          resource: res('acct-own'),
          now: NOW,
        }),
      ).toEqual({ allowed: false, reason: 'not-permitted' });
    }
  });

  it('root can still promote/disable/enable — the exclusion is on the OWNER branch only', () => {
    const root = actor({ isRoot: true });
    for (const action of [
      'account.promote',
      'account.disable',
      'account.enable',
    ] as const) {
      expect(
        evaluateAccessPolicy({
          actor: root,
          action,
          resource: res('acct-own'),
          now: NOW,
        }),
      ).toEqual({ allowed: true, source: 'root' });
    }
  });

  it('respects an injected grant-only catalog (a different app’s vocabulary)', () => {
    const root = actor({ isRoot: true });
    // Default vocabulary: staff.read is not grant-only → root bypass allows it.
    expect(
      evaluateAccessPolicy({
        actor: root,
        action: 'staff.read',
        resource: res(null),
        now: NOW,
      }),
    ).toEqual({ allowed: true, source: 'root' });
    // Injected: treat staff.read as grant-only → even root needs a grant, so
    // with none the bypass is withheld and the action is denied.
    expect(
      evaluateAccessPolicy({
        actor: root,
        action: 'staff.read',
        resource: res(null),
        now: NOW,
        grantOnlyActions: ['staff.read'],
      }),
    ).toEqual({ allowed: false, reason: 'not-permitted' });
  });
});
