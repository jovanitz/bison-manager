import { describe, expect, it } from 'vitest';
import type { AccountId, MembershipId, SessionId } from '@acme/domain';
import { testAccessActor } from '../../access/testing';
import type { AdminMembershipSnapshot } from '../ports';
import {
  inMemoryAdmin,
  testAdminDeps as deps,
  testAdminSession as session,
} from '../testing';
import { makeAccessAdminUseCases } from '../use-cases';

describe('revokeAllSessions', () => {
  const membership = (): AdminMembershipSnapshot => ({
    id: 'membership-target' as MembershipId,
    accountId: 'acct-1' as AccountId,
    accountKind: 'customer',
    permissions: [],
  });

  it('logs a membership out everywhere, audited per session', async () => {
    const admin = inMemoryAdmin({
      memberships: [membership()],
      sessions: [session('s1', 'acct-1'), session('s2', 'acct-1')],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).revokeAllSessions({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-target',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.revoked).toBe(2);
    expect(admin.audit.map((e) => e.type)).toEqual([
      'session.revoked',
      'session.revoked',
    ]);
  });

  it("denies revoking another account's membership with own scope", async () => {
    const admin = inMemoryAdmin({
      memberships: [{ ...membership(), accountId: 'acct-other' as AccountId }],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).revokeAllSessions({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-target',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });
});

describe('listSessions', () => {
  const membership = (accountId: string): AdminMembershipSnapshot => ({
    id: 'membership-target' as MembershipId,
    accountId: accountId as AccountId,
    accountKind: 'customer',
    permissions: [],
  });

  it('lets a customer list the sessions of their own account, with context', async () => {
    const admin = inMemoryAdmin({
      memberships: [membership('acct-1')],
      sessions: [session('s1', 'acct-1'), session('s2', 'acct-1', 'revoked')],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).listSessions({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-target',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((s) => s.id)).toEqual(['s1', 's2']);
      expect(r.value[0]?.userAgent).toBe('spec-agent');
      expect(r.value[0]?.lastIp).toBe('198.51.100.4');
    }
  });

  it("denies listing another account's sessions with own scope", async () => {
    const admin = inMemoryAdmin({ memberships: [membership('acct-other')] });
    const r = await makeAccessAdminUseCases(deps(admin)).listSessions({
      actor: testAccessActor({ preset: 'customer', accountId: 'acct-1' }),
      membershipId: 'membership-target',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
  });

  it('404s an unknown membership', async () => {
    const admin = inMemoryAdmin({});
    const r = await makeAccessAdminUseCases(deps(admin)).listSessions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-nope',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/membership-not-found');
  });
});

describe('revokeSession', () => {
  it('lets an owner revoke any session and audits it', async () => {
    const admin = inMemoryAdmin({
      sessions: [session('session-x', 'acct-other')],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).revokeSession({
      actor: testAccessActor({ preset: 'owner' }),
      sessionId: 'session-x',
    });
    expect(r.ok).toBe(true);
    expect(admin.sessions.get('session-x' as SessionId)?.status).toBe(
      'revoked',
    );
    expect(admin.audit[0]?.type).toBe('session.revoked');
  });

  it('lets a customer revoke sessions of their own account only', async () => {
    const admin = inMemoryAdmin({
      sessions: [
        session('session-own', 'acct-1'),
        session('session-foreign', 'acct-other'),
      ],
    });
    const uc = makeAccessAdminUseCases(deps(admin));
    const customer = testAccessActor({
      preset: 'customer',
      accountId: 'acct-1',
    });
    const own = await uc.revokeSession({
      actor: customer,
      sessionId: 'session-own',
    });
    const foreign = await uc.revokeSession({
      actor: customer,
      sessionId: 'session-foreign',
    });
    expect(own.ok).toBe(true);
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.tag).toBe('app/access-denied');
  });

  it('rejects revoking an already-revoked session', async () => {
    const admin = inMemoryAdmin({
      sessions: [session('session-x', 'acct-1', 'revoked')],
    });
    const r = await makeAccessAdminUseCases(deps(admin)).revokeSession({
      actor: testAccessActor({ preset: 'owner' }),
      sessionId: 'session-x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/session-already-revoked');
  });
});
