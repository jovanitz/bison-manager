import { describe, expect, it } from 'vitest';
import { ACCESS_ACTIONS } from '../access/value-objects';
import { PLAN_FEATURES, parsePlanFeature } from './entitlements';

describe('PLAN_FEATURES', () => {
  it('lists every feature exactly once', () => {
    expect(new Set(PLAN_FEATURES).size).toBe(PLAN_FEATURES.length);
  });

  it('is DISJOINT from ACCESS_ACTIONS (ADR-0016 invariant)', () => {
    // Roles say who inside the org may act; the plan says what the org
    // bought. A shared name would let a customer-authored role smuggle a
    // premium feature past a downgrade (the rejected features-through-roles
    // design) — so the vocabularies must never overlap.
    const actions = new Set<string>(ACCESS_ACTIONS);
    const overlap = PLAN_FEATURES.filter((feature) => actions.has(feature));
    expect(overlap).toEqual([]);
  });
});

describe('parsePlanFeature', () => {
  it('narrows a known feature', () => {
    const feature = parsePlanFeature('reports.advanced');
    expect(feature.ok && feature.value).toBe('reports.advanced');
  });

  it('rejects anything outside the closed union', () => {
    for (const raw of ['reports', 'customer.read', '', 'REPORTS.ADVANCED']) {
      const feature = parsePlanFeature(raw);
      expect(feature.ok).toBe(false);
      if (!feature.ok) {
        expect(feature.error.tag).toBe('domain/invalid-plan-feature');
      }
    }
  });
});
