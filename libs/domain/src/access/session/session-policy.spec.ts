import { describe, expect, it } from 'vitest';
import {
  ACCESS_SESSION_POLICY_DEFAULTS,
  accessSessionExpiryFrom,
  makeAccessSessionPolicies,
  slideAccessSessionExpiry,
} from './session-policy';

const HOUR = 3_600_000;
const MIN = 60_000;
const LOGIN = '2026-06-11T08:00:00.000Z';

const at = (offsetMs: number): string =>
  new Date(new Date(LOGIN).getTime() + offsetMs).toISOString();

describe('makeAccessSessionPolicies', () => {
  const valid = {
    customer: { idleTtlMs: 24 * HOUR, maxLifetimeMs: 72 * HOUR },
    staff: { idleTtlMs: 30 * MIN, maxLifetimeMs: 12 * HOUR },
  };

  it('accepts the defaults', () => {
    expect(makeAccessSessionPolicies(ACCESS_SESSION_POLICY_DEFAULTS).ok).toBe(
      true,
    );
    expect(makeAccessSessionPolicies(valid).ok).toBe(true);
  });

  it('rejects out-of-bounds and inconsistent values', () => {
    const cases = [
      { ...valid, staff: { ...valid.staff, idleTtlMs: 1 * MIN } }, // < 5 min
      {
        ...valid,
        customer: { ...valid.customer, maxLifetimeMs: 31 * 24 * HOUR }, // > 30 d
      },
      { ...valid, staff: { idleTtlMs: 13 * HOUR, maxLifetimeMs: 12 * HOUR } }, // idle > max
      { ...valid, staff: { ...valid.staff, idleTtlMs: 25 * HOUR } }, // staff > customer
      {
        ...valid,
        staff: { idleTtlMs: 30 * MIN, maxLifetimeMs: 73 * HOUR }, // staff max > customer max
      },
    ];
    for (const raw of cases) {
      const r = makeAccessSessionPolicies(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe('domain/invalid-session-policy');
    }
  });
});

describe('accessSessionExpiryFrom', () => {
  const policy = ACCESS_SESSION_POLICY_DEFAULTS.customer;

  it('uses the idle clock while far from the absolute cap', () => {
    expect(accessSessionExpiryFrom(policy, LOGIN, LOGIN)).toBe(at(24 * HOUR));
  });

  it('caps at createdAt + max lifetime near the end', () => {
    expect(accessSessionExpiryFrom(policy, LOGIN, at(60 * HOUR))).toBe(
      at(72 * HOUR),
    );
  });
});

describe('slideAccessSessionExpiry', () => {
  const policy = ACCESS_SESSION_POLICY_DEFAULTS.staff; // 30 min / 12 h

  it('slides an active session forward on use', () => {
    const slid = slideAccessSessionExpiry({
      session: { createdAt: LOGIN, expiresAt: at(30 * MIN) },
      policy,
      now: at(20 * MIN),
    });
    expect(slid).toBe(at(50 * MIN));
  });

  it('never resurrects an already-expired session', () => {
    expect(
      slideAccessSessionExpiry({
        session: { createdAt: LOGIN, expiresAt: at(30 * MIN) },
        policy,
        now: at(31 * MIN),
      }),
    ).toBeNull();
  });

  it('respects the absolute cap: an always-active session still ends', () => {
    const nearEnd = slideAccessSessionExpiry({
      session: { createdAt: LOGIN, expiresAt: at(11 * HOUR + 50 * MIN) },
      policy,
      now: at(11 * HOUR + 45 * MIN),
    });
    expect(nearEnd).toBe(at(12 * HOUR));
    const atCap = slideAccessSessionExpiry({
      session: { createdAt: LOGIN, expiresAt: at(12 * HOUR) },
      policy,
      now: at(11 * HOUR + 58 * MIN),
    });
    expect(atCap).toBeNull(); // extension below threshold: cap already reached
  });

  it('skips writes below the slide threshold', () => {
    expect(
      slideAccessSessionExpiry({
        session: { createdAt: LOGIN, expiresAt: at(30 * MIN) },
        policy,
        now: at(2 * MIN), // candidate = 32 min → +2 min < 5 min threshold
      }),
    ).toBeNull();
  });
});
