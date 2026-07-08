/**
 * Pure diff/format helpers for the plan-edit review step (review.tsx).
 * Kept out of plans.types.ts to stay under the file-size cap; imports only the
 * types from there, so wiring can reuse these to map a real before/after.
 */
import type {
  PlanChangeLine,
  PlanDraft,
  PlanPrice,
  PlanRow,
  PlanVisibility,
} from '../plans.types';

const intervalShort = (i: PlanPrice['interval']): string =>
  i === 'month' ? 'mo' : 'yr';

export const fmtPrice = (p: PlanPrice | null): string =>
  p === null
    ? 'No price yet'
    : `${p.amountCents / 100} ${p.currency}/${intervalShort(p.interval)}`;

export const fmtLimit = (n: number | null): string =>
  n === null ? 'Unlimited' : String(n);

const trialLabel = (m: number): string => (m === 0 ? 'No trial' : `${m} mo`);

const visLabel = (v: PlanVisibility): string =>
  v === 'hidden' ? 'Hidden' : 'Public';

/** A price edit that strictly raises an existing price — the one change that
 *  moves every current subscriber to a higher charge (grandfather callout). */
export const priceRaised = (
  before: PlanPrice | null,
  after: PlanPrice | null,
): boolean =>
  before !== null && after !== null && after.amountCents > before.amountCents;

/** The before→after lines for the review step: only fields that actually
 *  changed. Features collapse to a count (the picker showed the detail). */
export const planChangeLines = (
  before: PlanRow,
  after: PlanDraft,
): readonly PlanChangeLine[] => {
  const lines: PlanChangeLine[] = [];
  const add = (label: string, b: string, a: string) => {
    if (b !== a) lines.push({ label, before: b, after: a });
  };
  add('Display name', before.displayName, after.displayName);
  add('Availability', visLabel(before.visibility), visLabel(after.visibility));
  add('Price', fmtPrice(before.price), fmtPrice(after.price));
  add(
    'Free trial',
    trialLabel(before.trialMonths),
    trialLabel(after.trialMonths),
  );
  add(
    'Max orgs owned',
    fmtLimit(before.maxOrganizationsOwned),
    fmtLimit(after.maxOrganizationsOwned),
  );
  add(
    'Max members per org',
    fmtLimit(before.maxMembersPerOrg),
    fmtLimit(after.maxMembersPerOrg),
  );
  const changedFeatures =
    before.features.length !== after.features.length ||
    before.features.some((f) => !after.features.includes(f));
  if (changedFeatures) {
    add(
      'Features',
      `${before.features.length} included`,
      `${after.features.length} included`,
    );
  }
  return lines;
};
