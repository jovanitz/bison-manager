import { describe, expect, it } from 'vitest';
import { subscription } from '../../billing-subscriptions/testing';
import {
  ORG,
  makeLedgerWorld,
  openCharge,
  outsider,
  proPlan,
  staff,
} from '../testing';

const gen = { actor: staff, accountId: ORG };

describe('generateCharges', () => {
  it('bills the first due period once the trial has ended', async () => {
    const { useCases, charges } = makeLedgerWorld({
      sub: subscription({
        planId: proPlan().id,
        trialEndsAt: '2026-06-05T00:00:00.000Z', // ended, in grace at now
      }),
      plans: [proPlan()],
      charges: [],
    });
    const result = await useCases.generateCharges(gen);
    expect(result.ok).toBe(true);
    expect(charges.rows()).toHaveLength(1);
    expect(charges.rows()[0]?.period.from).toBe('2026-06-05T00:00:00.000Z');
    expect(result.ok && result.value.phase).toBe('grace');
  });

  it('keeps the debt bounded — no new charge while one is open', async () => {
    const { useCases, charges } = makeLedgerWorld({
      sub: subscription({
        planId: proPlan().id,
        trialEndsAt: '2026-06-05T00:00:00.000Z',
      }),
      plans: [proPlan()],
      charges: [openCharge()],
    });
    await useCases.generateCharges(gen);
    expect(charges.rows()).toHaveLength(1);
  });

  it('bills nothing while still in trial (not yet due)', async () => {
    const { useCases, charges } = makeLedgerWorld({
      sub: subscription({
        planId: proPlan().id,
        trialEndsAt: '2026-09-01T00:00:00.000Z', // trial ongoing at now
      }),
      plans: [proPlan()],
      charges: [],
    });
    await useCases.generateCharges(gen);
    expect(charges.rows()).toHaveLength(0);
  });

  it('bills nothing on a free (price-undecided) plan', async () => {
    const { useCases, charges } = makeLedgerWorld({
      sub: subscription({ trialEndsAt: '2026-06-05T00:00:00.000Z' }),
      charges: [],
    });
    await useCases.generateCharges(gen);
    expect(charges.rows()).toHaveLength(0);
  });

  it('denies generation without plans.manage', async () => {
    const { useCases } = makeLedgerWorld({
      sub: subscription({
        planId: proPlan().id,
        trialEndsAt: '2026-06-05T00:00:00.000Z',
      }),
      plans: [proPlan()],
      charges: [],
    });
    const result = await useCases.generateCharges({
      actor: outsider,
      accountId: ORG,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.tag).toBe('app/access-denied');
  });
});
