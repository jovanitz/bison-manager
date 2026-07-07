import { describe, expect, it } from 'vitest';
import { BILLING_EVENT_TYPES } from './events';

describe('BILLING_EVENT_TYPES', () => {
  it('catalogues every billing event exactly once', () => {
    // Exhaustiveness vs the union is enforced at compile time (events.ts);
    // here we pin uniqueness and the ADR-0016 day-1 non-negotiable set.
    expect(new Set(BILLING_EVENT_TYPES).size).toBe(BILLING_EVENT_TYPES.length);
    for (const required of [
      'plan.created',
      'plan.updated',
      'plan.retired',
      'plan.reset',
      'billing.default-plan-changed',
      'subscription.started',
      'subscription.plan-changed',
      'subscription.paid-marked',
      'subscription.trial-extended',
      'subscription.trial-expired',
      'subscription.override-set',
    ]) {
      expect(BILLING_EVENT_TYPES).toContain(required);
    }
  });
});
