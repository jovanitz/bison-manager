import { describe, expect, it } from 'vitest';
import {
  findNewlyExpiredAccessGrants,
  recordAccessGrantExpiry,
} from './expiry';
import {
  IMPERSONATION_GRANT_ACTIONS,
  createImpersonationGrant,
  endImpersonationGrant,
  isAccessGrantActive,
} from './grant';
import type { AccessGrant } from './grant';

const NOW = '2026-06-09T12:00:00.000Z';
const IN_30_MIN = '2026-06-09T12:30:00.000Z';
const IN_2_HOURS = '2026-06-09T14:00:00.000Z';
const PAST = '2026-06-09T11:00:00.000Z';

const baseInput = {
  id: 'grant-1' as AccessGrant['id'],
  membershipId: 'membership-support' as AccessGrant['membershipId'],
  targetAccountId: 'acct-customer' as AccessGrant['targetAccountId'],
  reason: 'Customer ticket #42: billing mismatch',
  occurredAt: NOW,
  expiresAt: IN_30_MIN,
};

describe('createImpersonationGrant', () => {
  it('creates a view-only grant and its audit event atomically', () => {
    const result = createImpersonationGrant(baseInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grant.actions).toEqual(IMPERSONATION_GRANT_ACTIONS);
    expect(result.value.grant.kind).toBe('impersonation');
    expect(isAccessGrantActive(result.value.grant, NOW)).toBe(true);
    expect(result.value.event.type).toBe('impersonation.started');
    expect(result.value.event.reason).toBe(baseInput.reason);
    expect(result.value.event.targetAccountId).toBe('acct-customer');
  });

  it('requires a non-empty reason', () => {
    const result = createImpersonationGrant({ ...baseInput, reason: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.tag).toBe('domain/invalid-grant-reason');
  });

  it('rejects an expiry in the past', () => {
    const result = createImpersonationGrant({ ...baseInput, expiresAt: PAST });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.tag).toBe('domain/invalid-grant-expiry');
  });

  it('caps the grant lifetime', () => {
    const result = createImpersonationGrant({
      ...baseInput,
      expiresAt: IN_2_HOURS,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.tag).toBe('domain/invalid-grant-expiry');
  });
});

describe('endImpersonationGrant', () => {
  const grant = (): AccessGrant => {
    const created = createImpersonationGrant(baseInput);
    if (!created.ok) throw new Error('setup');
    return created.value.grant;
  };

  it('revokes the grant and emits impersonation.ended', () => {
    const ended = endImpersonationGrant(grant(), NOW);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.grant.revokedAt).toBe(NOW);
    expect(isAccessGrantActive(ended.value.grant, NOW)).toBe(false);
    expect(ended.value.event.type).toBe('impersonation.ended');
  });

  it('cannot end an already-ended grant', () => {
    const once = endImpersonationGrant(grant(), NOW);
    if (!once.ok) throw new Error('setup');
    const twice = endImpersonationGrant(once.value.grant, NOW);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error.tag).toBe('domain/grant-not-active');
  });

  it('cannot end an expired grant', () => {
    const result = endImpersonationGrant(grant(), IN_2_HOURS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('domain/grant-not-active');
  });
});

describe('lazy expiry recording', () => {
  const activeGrant = (): AccessGrant => {
    const created = createImpersonationGrant(baseInput);
    if (!created.ok) throw new Error('setup');
    return created.value.grant;
  };

  it('finds grants that expired without being revoked or recorded', () => {
    const grant = activeGrant();
    expect(findNewlyExpiredAccessGrants([grant], NOW)).toHaveLength(0);
    expect(findNewlyExpiredAccessGrants([grant], IN_2_HOURS)).toEqual([grant]);
  });

  it('records grant.expired once and deduplicates afterwards', () => {
    const recorded = recordAccessGrantExpiry(activeGrant(), IN_2_HOURS);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(recorded.value.event.type).toBe('grant.expired');
    expect(recorded.value.grant.expiryRecordedAt).toBe(IN_2_HOURS);
    expect(
      findNewlyExpiredAccessGrants([recorded.value.grant], IN_2_HOURS),
    ).toHaveLength(0);
    const again = recordAccessGrantExpiry(recorded.value.grant, IN_2_HOURS);
    expect(again.ok).toBe(false);
  });

  it('does not record expiry for revoked or still-active grants', () => {
    const active = recordAccessGrantExpiry(activeGrant(), NOW);
    expect(active.ok).toBe(false);
    const ended = endImpersonationGrant(activeGrant(), NOW);
    if (!ended.ok) throw new Error('setup');
    const revoked = recordAccessGrantExpiry(ended.value.grant, IN_2_HOURS);
    expect(revoked.ok).toBe(false);
  });
});
