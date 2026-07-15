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
  readonly phases: ReadonlySet<string>;
  readonly needsAttention: boolean;
  readonly dormant: boolean;
  readonly pendingDeletion: boolean;
};

export const emptyFilters: OrgFilters = {
  status: new Set(),
  plans: new Set(),
  phases: new Set(),
  needsAttention: false,
  dormant: false,
  pendingDeletion: false,
};

/** Same precedence as the Status badge — a disabled account outranks a block. */
export const orgStatusOf = (r: CustomerRow): OrgStatus => {
  if (r.disabled) return 'disabled';
  if (r.blocked) return 'blocked';
  return 'active';
};

/** The "Needs attention" preset — an org with a live payment problem to act on:
 *  its subscription is past due (`grace`) or suspended for non-payment. Derived
 *  from the real billing phase, not a fabricated overdue count. Deliberate
 *  states (blocked, disabled) and neutral ones (trialing, canceled) don't count. */
export const flagged = (r: CustomerRow): boolean =>
  r.phase === 'grace' || r.phase === 'suspended';

export const filtersActive = (f: OrgFilters): boolean =>
  f.status.size > 0 ||
  f.plans.size > 0 ||
  f.phases.size > 0 ||
  f.needsAttention ||
  f.dormant ||
  f.pendingDeletion;

/** The multi-value facets (Status / Plan / Phase) — AND across kinds, OR within. */
const matchesFacets = (r: CustomerRow, f: OrgFilters): boolean =>
  (f.status.size === 0 || f.status.has(orgStatusOf(r))) &&
  (f.plans.size === 0 || (r.plan !== undefined && f.plans.has(r.plan))) &&
  (f.phases.size === 0 || (r.phase !== undefined && f.phases.has(r.phase)));

export const matchesFilters = (r: CustomerRow, f: OrgFilters): boolean => {
  if (!matchesFacets(r, f)) return false;
  if (f.needsAttention && !flagged(r)) return false;
  if (f.dormant && !r.dormant) return false;
  if (f.pendingDeletion && !r.pendingDeletionUntil) return false;
  return true;
};

/** Immutable set toggle — add if absent, remove if present. */
export const toggleIn = <T>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};
