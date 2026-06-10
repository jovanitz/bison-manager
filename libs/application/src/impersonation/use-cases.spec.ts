import { describe, expect, it } from 'vitest';
import { TEST_ACCESS_NOW, testAccessActor } from '../access/testing';
import { testCustomerAccount, testImpersonationWorld } from './testing';
import { makeImpersonationUseCases } from './use-cases';

describe('startImpersonation', () => {
  it('creates a reasoned, expiring, view-only grant with its audit event', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const uc = makeImpersonationUseCases(world.deps);
    const r = await uc.startImpersonation({
      actor: testAccessActor({ preset: 'support' }),
      targetAccountId: 'acct-customer',
      reason: 'Ticket #42: billing mismatch',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.actions).toEqual(['customer.read']);
    expect(r.value.targetAccountId).toBe('acct-customer');
    expect(new Date(r.value.expiresAt).getTime()).toBeGreaterThan(
      new Date(TEST_ACCESS_NOW).getTime(),
    );
    expect(world.audit[0]?.type).toBe('impersonation.started');
  });

  it('caps the duration at the domain maximum', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const r = await makeImpersonationUseCases(world.deps).startImpersonation({
      actor: testAccessActor({ preset: 'support' }),
      targetAccountId: 'acct-customer',
      reason: 'long session request',
      durationMinutes: 600,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lifetimeMin =
      (new Date(r.value.expiresAt).getTime() -
        new Date(TEST_ACCESS_NOW).getTime()) /
      60_000;
    expect(lifetimeMin).toBeLessThanOrEqual(60);
  });

  it('requires a reason', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const r = await makeImpersonationUseCases(world.deps).startImpersonation({
      actor: testAccessActor({ preset: 'support' }),
      targetAccountId: 'acct-customer',
      reason: '  ',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('domain/invalid-grant-reason');
    expect(world.audit).toHaveLength(0);
  });

  it('denies customers and owners (no impersonation.start permission)', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const uc = makeImpersonationUseCases(world.deps);
    for (const preset of ['customer', 'owner'] as const) {
      const r = await uc.startImpersonation({
        actor: testAccessActor({ preset }),
        targetAccountId: 'acct-customer',
        reason: 'should not work',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('app/access-denied');
    }
  });

  it('fails when the target customer does not exist', async () => {
    const world = testImpersonationWorld([]);
    const r = await makeImpersonationUseCases(world.deps).startImpersonation({
      actor: testAccessActor({ preset: 'support' }),
      targetAccountId: 'acct-ghost',
      reason: 'Ticket #1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/customer-not-found');
  });
});

describe('endImpersonation', () => {
  const started = async (world: ReturnType<typeof testImpersonationWorld>) => {
    const uc = makeImpersonationUseCases(world.deps);
    const r = await uc.startImpersonation({
      actor: testAccessActor({ preset: 'support' }),
      targetAccountId: 'acct-customer',
      reason: 'Ticket #42',
    });
    if (!r.ok) throw new Error('setup');
    return { uc, grantId: r.value.id };
  };

  it('lets the holder end it and audits impersonation.ended', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const { uc, grantId } = await started(world);
    const r = await uc.endImpersonation({
      actor: testAccessActor({ preset: 'support' }),
      grantId,
    });
    expect(r.ok).toBe(true);
    expect(world.grants.get(grantId)?.revokedAt).toBe(TEST_ACCESS_NOW);
    expect(world.audit.map((e) => e.type)).toEqual([
      'impersonation.started',
      'impersonation.ended',
    ]);
  });

  it('refuses anyone who is not the grant holder', async () => {
    const world = testImpersonationWorld([
      testCustomerAccount('acct-customer'),
    ]);
    const { uc, grantId } = await started(world);
    const r = await uc.endImpersonation({
      actor: testAccessActor({
        preset: 'support',
        membershipId: 'membership-other',
      }),
      grantId,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe('app/impersonation-grant-not-owned');
  });
});
