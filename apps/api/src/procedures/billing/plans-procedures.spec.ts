import { describe, expect, it } from 'vitest';
import { callRpc, errorTag, testRuntime } from '../../testing/rpc-harness';

describe('plans.list', () => {
  it('returns the full catalog to the owner — the seeded Free plan present', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'plans.list', { token: 'session-owner' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      readonly data: ReadonlyArray<{
        readonly key: string;
        readonly isDefaultForNewOrgs: boolean;
      }>;
    };
    expect(body.data.map((p) => p.key)).toContain('free');
    expect(body.data.find((p) => p.key === 'free')?.isDefaultForNewOrgs).toBe(
      true,
    );
  });

  it('403s customers AND permissionless support with the generic denial', async () => {
    const { app } = testRuntime();
    for (const token of ['session-customer', 'session-support']) {
      const res = await callRpc(app, 'plans.list', { token });
      expect(res.status).toBe(403);
      expect(await errorTag(res)).toBe('app/access-denied');
    }
  });
});

describe('plan mutations (owner)', () => {
  it('creates a plan end-to-end and lists it', async () => {
    const { app } = testRuntime();
    const created = await callRpc(app, 'plans.create', {
      token: 'session-owner',
      body: {
        key: 'team',
        displayName: 'Team',
        internalNote: 'Mid tier for small clinics.',
        visibility: 'public',
        price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
        trialMonths: 1,
        limits: { maxOrganizationsOwned: 3, maxMembersPerOrg: 10 },
        features: ['export.csv'],
        reason: 'launching the mid tier',
      },
    });
    expect(created.status).toBe(200);
    const plan = ((await created.json()) as { data: { key: string } }).data;
    expect(plan.key).toBe('team');

    const list = await callRpc(app, 'plans.list', { token: 'session-owner' });
    const keys = ((await list.json()) as { data: Array<{ key: string }> }).data;
    expect(keys.map((p) => p.key)).toContain('team');
  });

  it('409s a stale expectedVersion on plans.update (the CAS instrument)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'plans.update', {
      token: 'session-owner',
      body: {
        planId: 'plan-free',
        changes: { displayName: 'Free v2' },
        expectedVersion: 99,
        reason: 'rename',
      },
    });
    expect(res.status).toBe(409);
    expect(await errorTag(res)).toBe('app/plan-concurrently-modified');
  });

  it('400s a reasonless mutation (app/reason-required)', async () => {
    const { app } = testRuntime();
    const res = await callRpc(app, 'plans.retire', {
      token: 'session-owner',
      body: { planId: 'plan-pro', reason: ' ' },
    });
    expect(res.status).toBe(400);
    expect(await errorTag(res)).toBe('app/reason-required');
  });

  it('previews the blast radius and lists a plan’s subscribers', async () => {
    const { app } = testRuntime();
    const preview = await callRpc(app, 'plans.preview', {
      token: 'session-owner',
      body: {
        planId: 'plan-free',
        changes: {
          entitlements: {
            limits: { maxOrganizationsOwned: 1, maxMembersPerOrg: 0 },
            features: [],
          },
        },
      },
    });
    expect(preview.status).toBe(200);
    expect(((await preview.json()) as { data: unknown }).data).toEqual({
      subscribers: 1,
      wouldGoOverLimit: 1,
      wouldLoseFeature: 0,
    });

    const subscribers = await callRpc(app, 'plans.subscribers', {
      token: 'session-owner',
      body: { planId: 'plan-free' },
    });
    expect(subscribers.status).toBe(200);
    expect(((await subscribers.json()) as { data: unknown }).data).toEqual([
      { accountId: 'acct-customer', since: '2026-03-01T00:00:00.000Z' },
    ]);
  });
});
