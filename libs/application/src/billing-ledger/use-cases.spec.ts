import { describe, expect, it } from 'vitest';
import { subscription } from '../billing-subscriptions/testing';
import {
  ORG,
  makeLedgerWorld,
  openCharge,
  outsider,
  paidCharge,
  staff,
} from './testing';

/** Trial is over at TEST_ACCESS_NOW (2026-06-09), so phase follows coverage. */
const postTrial = subscription({ trialEndsAt: '2026-03-01T00:00:00.000Z' });

const period = (from: string, to: string) => ({
  dueDate: from,
  period: { from, to },
});

describe('getCoverage', () => {
  it('derives active coverage for a paid-up account', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [paidCharge()],
    });
    const result = await useCases.getCoverage({ actor: staff, accountId: ORG });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.coverage.phase).toBe('active');
    expect(result.value.coverage.balance.minor).toBe(0);
    expect(result.value.coverage.paidThroughAt).toBe(
      '2026-07-05T00:00:00.000Z',
    );
    expect(result.value.coverage.dormant).toBe(false);
    // The subscribed plan rides along — the directory renders it without a
    // second round trip per org.
    expect(result.value.planName).toBe('Free');
  });

  it('is in grace within the grace window (service still on)', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [openCharge()], // due 2026-06-05, grace 10 → suspend 2026-06-15
    });
    const result = await useCases.getCoverage({ actor: staff, accountId: ORG });
    expect(result.ok && result.value.coverage.phase).toBe('grace');
    expect(result.ok && result.value.coverage.balance.minor).toBe(5684);
  });

  it('suspends once the grace window has elapsed', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [
        openCharge(
          period('2026-04-05T00:00:00.000Z', '2026-05-05T00:00:00.000Z'),
        ),
      ],
    });
    const result = await useCases.getCoverage({ actor: staff, accountId: ORG });
    expect(result.ok && result.value.coverage.phase).toBe('suspended');
    expect(result.ok && result.value.coverage.dormant).toBe(false);
  });

  it('flags dormant after a long suspension (beyond the dormant window)', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [
        openCharge(
          period('2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'),
        ),
      ],
    });
    const result = await useCases.getCoverage({ actor: staff, accountId: ORG });
    expect(result.ok && result.value.coverage.phase).toBe('suspended');
    expect(result.ok && result.value.coverage.dormant).toBe(true);
  });

  it('fails closed when the account has no subscription', async () => {
    const { useCases } = makeLedgerWorld({ sub: null });
    const result = await useCases.getCoverage({ actor: staff, accountId: ORG });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/subscription-not-found');
  });

  it('denies a reader without billing.read on the account', async () => {
    const { useCases } = makeLedgerWorld({
      sub: postTrial,
      charges: [paidCharge()],
    });
    const result = await useCases.getCoverage({
      actor: outsider,
      accountId: ORG,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/access-denied');
  });
});
