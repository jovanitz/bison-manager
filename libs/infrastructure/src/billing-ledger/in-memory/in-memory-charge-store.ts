import type { ChargeStore } from '@acme/application';
import type { Charge } from '@acme/domain';

/**
 * In-memory {@link ChargeStore} — the reference the Postgres adapter is
 * contract-tested against. `saveMany` upserts by id (settlement rewrites a
 * charge in place, never duplicates it).
 */
export const createInMemoryChargeStore = (
  initial: readonly Charge[] = [],
): ChargeStore => {
  let rows: readonly Charge[] = initial;
  return {
    listByAccount: async (accountId) =>
      rows.filter((c) => c.accountId === accountId),
    saveMany: async (charges) => {
      const ids = new Set(charges.map((c) => c.id));
      rows = [...rows.filter((c) => !ids.has(c.id)), ...charges];
    },
  };
};
