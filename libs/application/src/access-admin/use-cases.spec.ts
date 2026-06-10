import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type {
  AccessAuditEvent,
  AccessPermission,
  AccountId,
  MembershipId,
  SessionId,
} from '@acme/domain';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import type {
  AdminAccountSnapshot,
  AdminMembershipSnapshot,
  AdminSessionSnapshot,
} from './ports';
import { makeAccessAdminUseCases } from './use-cases';

const inMemoryAdmin = (seed: {
  accounts?: AdminAccountSnapshot[];
  memberships?: AdminMembershipSnapshot[];
  sessions?: AdminSessionSnapshot[];
}) => {
  const accounts = new Map(seed.accounts?.map((a) => [a.id, a]));
  const memberships = new Map(seed.memberships?.map((m) => [m.id, m]));
  const sessions = new Map(seed.sessions?.map((s) => [s.id, s]));
  const audit: AccessAuditEvent[] = [];
  return {
    audit,
    accounts,
    sessions,
    memberships,
    port: {
      findAccount: async (id: AccountId) => accounts.get(id) ?? null,
      disableAccount: async (id: AccountId, event: AccessAuditEvent) => {
        const account = accounts.get(id);
        if (account) accounts.set(id, { ...account, status: 'disabled' });
        audit.push(event);
      },
      findMembership: async (id: MembershipId) => memberships.get(id) ?? null,
      updatePermissions: async (
        id: MembershipId,
        permissions: ReadonlyArray<AccessPermission>,
        event: AccessAuditEvent,
      ) => {
        const membership = memberships.get(id);
        if (membership) memberships.set(id, { ...membership, permissions });
        audit.push(event);
      },
      findSession: async (id: SessionId) => sessions.get(id) ?? null,
      revokeSession: async (id: SessionId, event: AccessAuditEvent) => {
        const session = sessions.get(id);
        if (session) sessions.set(id, { ...session, status: 'revoked' });
        audit.push(event);
      },
    },
  };
};

const account = (id: string, status = 'active'): AdminAccountSnapshot => ({
  id: id as AccountId,
  status: status as AdminAccountSnapshot['status'],
});

const session = (
  id: string,
  accountId: string,
  status = 'active',
): AdminSessionSnapshot => ({
  id: id as SessionId,
  accountId: accountId as AccountId,
  status: status as AdminSessionSnapshot['status'],
});

const deps = (admin: ReturnType<typeof inMemoryAdmin>) => ({
  admin: admin.port,
  clock: fixedClock(new Date(TEST_ACCESS_NOW)),
});

describe('disableAccount', () => {
  it('lets an owner disable an account and audits it atomically', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const uc = makeAccessAdminUseCases(deps(admin));
    const r = await uc.disableAccount({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
      reason: 'fraud review',
    });
    expect(r.ok).toBe(true);
    expect(admin.accounts.get('acct-x' as AccountId)?.status).toBe('disabled');
    expect(admin.audit).toHaveLength(1);
    expect(admin.audit[0]?.type).toBe('account.disabled');
  });

  it('denies support and customers', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x')] });
    const uc = makeAccessAdminUseCases(deps(admin));
    for (const preset of ['support', 'customer'] as const) {
      const r = await uc.disableAccount({
        actor: testAccessActor({ preset }),
        accountId: 'acct-x',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
    expect(admin.audit).toHaveLength(0);
  });

  it('rejects disabling an already-disabled account', async () => {
    const admin = inMemoryAdmin({ accounts: [account('acct-x', 'disabled')] });
    const r = await makeAccessAdminUseCases(deps(admin)).disableAccount({
      actor: testAccessActor({ preset: 'owner' }),
      accountId: 'acct-x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/account-already-disabled');
  });
});

describe('updateUserPermissions', () => {
  const membership = (): AdminMembershipSnapshot => ({
    id: 'membership-target' as MembershipId,
    accountId: 'acct-target' as AccountId,
    permissions: [{ action: 'customer.read', scope: 'own' }],
  });

  it('replaces permissions and audits before/after', async () => {
    const admin = inMemoryAdmin({ memberships: [membership()] });
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [{ action: 'audit.read', scope: 'any' }],
    });
    expect(r.ok).toBe(true);
    const event = admin.audit[0];
    expect(event?.type).toBe('permissions.updated');
    if (event?.type === 'permissions.updated') {
      expect(event.before).toEqual([{ action: 'customer.read', scope: 'own' }]);
      expect(event.after).toEqual([{ action: 'audit.read', scope: 'any' }]);
    }
  });

  it('rejects unknown actions and scopes at the boundary', async () => {
    const admin = inMemoryAdmin({ memberships: [membership()] });
    const uc = makeAccessAdminUseCases(deps(admin));
    const badAction = await uc.updateUserPermissions({
      actor: testAccessActor({ preset: 'owner' }),
      membershipId: 'membership-target',
      permissions: [{ action: 'database.drop', scope: 'any' }],
    });
    expect(badAction.ok).toBe(false);
    if (!badAction.ok)
      expect(badAction.error.tag).toBe('domain/invalid-access-action');
    expect(admin.audit).toHaveLength(0);
  });

  it('denies non-owners', async () => {
    const admin = inMemoryAdmin({ memberships: [membership()] });
    const r = await makeAccessAdminUseCases(deps(admin)).updateUserPermissions({
      actor: testAccessActor({ preset: 'support' }),
      membershipId: 'membership-target',
      permissions: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
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
