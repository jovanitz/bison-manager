import { describe, expect, it } from 'vitest';
import { statusForErrorTag } from './procedure';

describe('statusForErrorTag', () => {
  it('maps each Result error family to its HTTP status', () => {
    expect(statusForErrorTag('app/access-denied')).toBe(403);
    expect(statusForErrorTag('app/impersonation-grant-not-owned')).toBe(403);
    expect(statusForErrorTag('app/access-actor-not-found')).toBe(401);
    expect(statusForErrorTag('app/customer-not-found')).toBe(404);
    expect(statusForErrorTag('app/session-not-found')).toBe(404);
    expect(statusForErrorTag('domain/invalid-grant-expiry')).toBe(400);
    expect(statusForErrorTag('domain/grant-not-active')).toBe(400);
    expect(statusForErrorTag('app/account-already-disabled')).toBe(409);
    expect(statusForErrorTag('app/session-already-revoked')).toBe(409);
  });

  it('maps the billing tags (ADR-0016): 402 upsell, 403 never', () => {
    expect(statusForErrorTag('app/subscription-expired')).toBe(402);
    expect(statusForErrorTag('app/feature-not-in-plan')).toBe(402);
    expect(statusForErrorTag('app/subscription-not-found')).toBe(404);
    expect(statusForErrorTag('app/plan-not-found')).toBe(404);
    expect(statusForErrorTag('app/plan-seed-missing')).toBe(404);
    expect(statusForErrorTag('app/reason-required')).toBe(400);
    expect(statusForErrorTag('app/plan-limit-exceeded')).toBe(409);
    expect(statusForErrorTag('app/plan-key-taken')).toBe(409);
    expect(statusForErrorTag('app/plan-concurrently-modified')).toBe(409);
    expect(statusForErrorTag('app/plan-retired')).toBe(409);
    expect(statusForErrorTag('app/default-plan-missing')).toBe(409);
  });
});
