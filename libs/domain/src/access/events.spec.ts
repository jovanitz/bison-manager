import { describe, expect, it } from 'vitest';
import { ACCESS_AUDIT_EVENT_TYPES } from './events';

describe('ACCESS_AUDIT_EVENT_TYPES', () => {
  it('catalogues every audit event exactly once', () => {
    // Exhaustiveness vs the union is enforced at compile time (events.ts);
    // here we pin uniqueness and the spec-relevant members.
    expect(new Set(ACCESS_AUDIT_EVENT_TYPES).size).toBe(
      ACCESS_AUDIT_EVENT_TYPES.length,
    );
    expect(ACCESS_AUDIT_EVENT_TYPES).toContain('settings.updated');
    expect(ACCESS_AUDIT_EVENT_TYPES).toContain('owner.bootstrapped');
  });
});
