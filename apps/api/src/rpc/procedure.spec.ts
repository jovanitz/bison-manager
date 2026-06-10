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
});
