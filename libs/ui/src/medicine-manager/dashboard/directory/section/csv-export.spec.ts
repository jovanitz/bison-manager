import { describe, expect, it } from 'vitest';
import type { CustomerRow } from '../directory.columns';
import { directoryCsv, orgCsv } from './csv-export';

const rows: readonly CustomerRow[] = [
  {
    accountId: 'a1',
    displayName: 'Acme Clinic',
    email: 'ops@acme.test',
    memberCount: 4,
    plan: 'Pro',
    phase: 'active',
    blocked: false,
    disabled: false,
  },
  {
    accountId: 'a2',
    displayName: 'Bize, "The" Lab',
    email: undefined,
    memberCount: 1,
    phase: 'grace',
    dormant: true,
  },
  {
    accountId: 'a3',
    displayName: 'Gone Corp',
    phase: 'suspended',
    pendingDeletionUntil: '2026-08-13T00:00:00.000Z',
  },
];

const lines = (csv: string): string[] => csv.split('\r\n');

describe('directoryCsv', () => {
  it('emits a header row plus one row per customer', () => {
    const out = lines(directoryCsv(rows, []));
    expect(out).toHaveLength(4);
    expect(out[0]).toContain('Organization');
    expect(out[0]).toContain('Status');
  });

  it('escapes quotes and commas per RFC 4180', () => {
    const bize = lines(directoryCsv(rows, ['a2']))[1];
    // display name has a comma and embedded quotes → wrapped + doubled quotes.
    expect(bize).toContain('"Bize, ""The"" Lab"');
  });

  it('derives an HONEST status — no fabricated overdue counts', () => {
    const csv = directoryCsv(rows, []);
    const byId = lines(csv).slice(1);
    // pending-deletion wins, then dormant; active phase reads through as-is.
    expect(byId[0]).toContain('active');
    expect(byId[1]).toContain('dormant');
    expect(byId[2]).toContain('pending-deletion');
    expect(csv).not.toContain('overdue');
  });

  it('filters to the requested ids (empty = whole current view)', () => {
    expect(lines(directoryCsv(rows, ['a1', 'a3']))).toHaveLength(3);
    expect(lines(directoryCsv(rows, []))).toHaveLength(4);
  });

  it('blank cell for a missing email, never the string "undefined"', () => {
    const bize = directoryCsv(rows, ['a2']);
    expect(bize).not.toContain('undefined');
  });
});

describe('orgCsv', () => {
  it('serializes a single org (header + one row)', () => {
    const csv = orgCsv(rows, 'a1');
    expect(csv).not.toBeNull();
    expect(lines(csv as string)).toHaveLength(2);
    expect(csv).toContain('Acme Clinic');
  });

  it('returns null for an unknown account', () => {
    expect(orgCsv(rows, 'nope')).toBeNull();
  });
});
