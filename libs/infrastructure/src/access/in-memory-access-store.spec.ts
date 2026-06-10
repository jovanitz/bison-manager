import { describe, expect, it } from 'vitest';
import {
  accessPresetPermissions,
  createImpersonationGrant,
  makeSessionId,
  recordAccessGrantExpiry,
} from '@acme/domain';
import type { AccessGrant, AccountId, MembershipId } from '@acme/domain';
import { createInMemoryAccessStore } from './in-memory-access-store';
import type { InMemoryAccessSeed } from './in-memory-access-seed';

const NOW = '2026-06-09T12:00:00.000Z';
const SESSION_EXPIRES = '2026-06-09T18:00:00.000Z';

const baseSeed = (): InMemoryAccessSeed => ({
  accounts: [{ id: 'acct-support' }, { id: 'acct-customer' }],
  memberships: [
    {
      id: 'membership-support',
      userId: 'user-support',
      accountId: 'acct-support',
      permissions: accessPresetPermissions('support'),
    },
  ],
  sessions: [
    {
      id: 'session-support',
      membershipId: 'membership-support',
      expiresAt: SESSION_EXPIRES,
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

const supportGrant = (occurredAt: string, expiresAt: string): AccessGrant => {
  const created = createImpersonationGrant({
    id: 'grant-1' as AccessGrant['id'],
    membershipId: 'membership-support' as MembershipId,
    targetAccountId: 'acct-customer' as AccountId,
    reason: 'ticket #42',
    occurredAt,
    expiresAt,
  });
  if (!created.ok) throw new Error('setup');
  return created.value.grant;
};

const sessionId = (raw: string) => {
  const made = makeSessionId(raw);
  if (!made.ok) throw new Error('setup');
  return made.value;
};

describe('createInMemoryAccessStore', () => {
  it('derives the actor by joining session → membership → account → grants', async () => {
    const grant = supportGrant(
      '2026-06-09T12:40:00.000Z',
      '2026-06-09T13:00:00.000Z',
    );
    const store = createInMemoryAccessStore({ ...baseSeed(), grants: [grant] });

    const actor = await store.actors.findActorBySession(
      sessionId('session-support'),
    );

    expect(actor?.membership.accountId).toBe('acct-support');
    expect(actor?.accountStatus).toBe('active');
    expect(actor?.permissions).toEqual(accessPresetPermissions('support'));
    expect(actor?.grants).toEqual([grant]);
    expect(
      await store.actors.findActorBySession(sessionId('session-x')),
    ).toBeNull();
  });

  it('makes admin mutations visible on the next actor read, with their audit events', async () => {
    const store = createInMemoryAccessStore(baseSeed());
    const membershipId = 'membership-support' as MembershipId;

    await store.admin.disableAccount('acct-support' as AccountId, {
      type: 'account.disabled',
      accountId: 'acct-support' as AccountId,
      actorMembershipId: membershipId,
      reason: null,
      occurredAt: NOW,
    });
    await store.admin.revokeSession(sessionId('session-support'), {
      type: 'session.revoked',
      sessionId: sessionId('session-support'),
      actorMembershipId: membershipId,
      occurredAt: NOW,
    });
    await store.admin.updatePermissions(membershipId, [], {
      type: 'permissions.updated',
      membershipId,
      actorMembershipId: membershipId,
      before: accessPresetPermissions('support'),
      after: [],
      occurredAt: NOW,
    });

    const actor = await store.actors.findActorBySession(
      sessionId('session-support'),
    );
    expect(actor?.accountStatus).toBe('disabled');
    expect(actor?.session.status).toBe('revoked');
    expect(actor?.permissions).toEqual([]);
    expect((await store.auditTrail.list()).map((r) => r.event.type)).toEqual([
      'account.disabled',
      'session.revoked',
      'permissions.updated',
    ]);
  });

  it('persists grants and lazy expiry together with their audit events', async () => {
    const grant = supportGrant(
      '2026-06-09T10:00:00.000Z',
      '2026-06-09T10:30:00.000Z',
    );
    const store = createInMemoryAccessStore(baseSeed());

    await store.grants.saveNew(grant, {
      type: 'impersonation.started',
      grantId: grant.id,
      actorMembershipId: grant.membershipId,
      targetAccountId: grant.targetAccountId,
      reason: grant.reason,
      actions: grant.actions,
      expiresAt: grant.expiresAt,
      occurredAt: grant.createdAt,
    });
    expect(await store.grants.findById(grant.id)).toEqual(grant);

    const recorded = recordAccessGrantExpiry(grant, NOW);
    if (!recorded.ok) throw new Error('setup');
    await store.grantExpiry.recordExpiry([recorded.value]);

    expect((await store.grants.findById(grant.id))?.expiryRecordedAt).toBe(NOW);
    const types = (await store.auditTrail.list()).map((r) => r.event.type);
    expect(types).toEqual(['impersonation.started', 'grant.expired']);
  });

  it('searches and reads only seeded customer accounts', async () => {
    const store = createInMemoryAccessStore(baseSeed());

    expect(await store.customers.search('casa')).toEqual([
      {
        accountId: 'acct-customer',
        displayName: 'Casa Pampa',
        email: 'ops@casapampa.example',
      },
    ]);
    expect(await store.customers.search('nadie')).toEqual([]);
    expect(
      await store.customers.read('acct-customer' as AccountId),
    ).toMatchObject({ displayName: 'Casa Pampa', status: 'active' });
    expect(await store.customers.read('acct-support' as AccountId)).toBeNull();
  });

  it('filters the audit trail by type, account and limit', async () => {
    const store = createInMemoryAccessStore(baseSeed());
    await store.auditTrail.append({
      type: 'login.failed',
      attemptedIdentifier: 'mallory@example.com',
      occurredAt: NOW,
    });
    await store.auditTrail.append({
      type: 'account.disabled',
      accountId: 'acct-customer' as AccountId,
      actorMembershipId: 'membership-support' as MembershipId,
      reason: null,
      occurredAt: NOW,
    });

    const byType = await store.auditTrail.list({ types: ['account.disabled'] });
    expect(byType).toHaveLength(1);
    const byAccount = await store.auditTrail.list({
      accountId: 'acct-customer',
    });
    expect(byAccount).toHaveLength(1);
    const limited = await store.auditTrail.list({ limit: 1 });
    expect(limited[0]?.event.type).toBe('login.failed');
  });
});
