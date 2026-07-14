import { describe, expect, it } from 'vitest';
import { fixedClock } from '@acme/shared';
import type { Charge, Subscription } from '@acme/domain';
import { TEST_ACCESS_NOW } from '../access/testing';
import { subscription } from '../billing-subscriptions/testing';
import { makeCoverageReader } from './coverage-reader';
import { ORG, openCharge, paidCharge } from './testing';

const reader = (sub: Subscription | null, charges: readonly Charge[]) =>
  makeCoverageReader({
    subscriptions: {
      findByAccount: async (id) => (sub && sub.accountId === id ? sub : null),
    },
    charges: {
      listByAccount: async (id) => charges.filter((c) => c.accountId === id),
    },
    clock: fixedClock(new Date(TEST_ACCESS_NOW)),
    policy: { currency: 'MXN', dormantDays: 90 },
  });

const postTrial = subscription({ trialEndsAt: '2026-03-01T00:00:00.000Z' });

describe('makeCoverageReader', () => {
  it('flattens active coverage for a paid-up account', async () => {
    const cov = await reader(postTrial, [paidCharge()]).coverageFor(ORG);
    expect(cov?.phase).toBe('active');
    expect(cov?.balanceMinor).toBe(0);
    expect(cov?.currency).toBe('MXN');
    expect(cov?.paidThroughAt).toBe('2026-07-05T00:00:00.000Z');
  });

  it('reports the outstanding balance when suspended', async () => {
    const cov = await reader(postTrial, [
      openCharge({
        dueDate: '2026-04-05T00:00:00.000Z',
        period: {
          from: '2026-04-05T00:00:00.000Z',
          to: '2026-05-05T00:00:00.000Z',
        },
      }),
    ]).coverageFor(ORG);
    expect(cov?.phase).toBe('suspended');
    expect(cov?.balanceMinor).toBe(5684);
  });

  it('returns null when the account has no subscription', async () => {
    expect(await reader(null, []).coverageFor(ORG)).toBeNull();
  });
});
