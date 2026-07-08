/**
 * Pure client-side filtering for the Organizations tab — no framework, no state.
 * Facets combine as AND across kinds, OR within a kind (e.g. Blocked OR Disabled).
 * "Needs attention" is a preset = blocked / disabled / pending payment.
 */
import type { CustomerRow } from '../directory.columns';

export type OrgStatus = 'active' | 'blocked' | 'disabled';

export type OrgFilters = {
  readonly status: ReadonlySet<string>;
  readonly plans: ReadonlySet<string>;
  readonly needsAttention: boolean;
};

export const emptyFilters: OrgFilters = {
  status: new Set(),
  plans: new Set(),
  needsAttention: false,
};

/** Same precedence as the Status badge — a disabled account outranks a block. */
export const orgStatusOf = (r: CustomerRow): OrgStatus => {
  if (r.disabled) return 'disabled';
  if (r.blocked) return 'blocked';
  return 'active';
};

/** The "Needs attention" preset — an org with a payment problem to act on
 *  (pending / overdue charge). Deliberate states (blocked, disabled) don't count. */
export const flagged = (r: CustomerRow): boolean => r.pendingPayment === true;

export const filtersActive = (f: OrgFilters): boolean =>
  f.status.size > 0 || f.plans.size > 0 || f.needsAttention;

export const matchesFilters = (r: CustomerRow, f: OrgFilters): boolean => {
  if (f.status.size > 0 && !f.status.has(orgStatusOf(r))) return false;
  if (f.plans.size > 0 && (r.plan === undefined || !f.plans.has(r.plan)))
    return false;
  if (f.needsAttention && !flagged(r)) return false;
  return true;
};

/** Immutable set toggle — add if absent, remove if present. */
export const toggleIn = <T>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};
