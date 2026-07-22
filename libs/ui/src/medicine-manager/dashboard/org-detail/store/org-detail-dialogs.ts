import type { PlanDto } from '@acme/application';
import type {
  OrgSubscriptionVM,
  PlanOption,
  RecordPaymentPreview,
} from '../org-detail.types';

/**
 * Pure builders for the billing-lever dialogs' DATA (ADR-0016). The store
 * fetches the plan catalog + reads the current subscription, then these shape
 * what the change-plan / record-payment dialogs render. `billing.markPaid` takes
 * an ABSOLUTE paid-through date, so the preview computed here is authoritative —
 * the date shown read-only is exactly the one submitted (no server recompute).
 */
const money = (minor: number): string =>
  '$' +
  (minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const humanDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? '?'} ${d.getUTCFullYear()}`;
};
const dateOnly = (iso: string): string => iso.slice(0, 10);

/** One month forward, clamped to the month's end (30 Jan + 1mo → 28/29 Feb). */
const addMonth = (iso: string): string => {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString();
};

const priceLabel = (price: PlanDto['price']): string | null =>
  price ? `$${price.amountCents / 100} / ${price.interval}` : null;

/** Active plans as selectable rows; the current one (matched by display name)
 *  is marked, hidden ones are badged (staff-assign only). Retired plans drop. */
export const buildChangePlanOptions = (
  plans: readonly PlanDto[],
  currentPlanName: string,
): readonly PlanOption[] =>
  plans
    .filter((p) => p.status === 'active')
    .map((p) => ({
      planId: p.id,
      label: p.displayName,
      hidden: p.visibility === 'hidden',
      priceLabel: priceLabel(p.price),
      current: p.displayName === currentPlanName,
    }));

/**
 * The record-payment preview: extend coverage by one period from the later of
 * "now" and the current paid-through. Amount is the current plan's real price
 * (from the catalog); no downtime credit is modelled (a v1 simplification —
 * staff confirm the exact date shown).
 */
export const buildRecordPaymentPreview = (
  subscription: OrgSubscriptionVM,
  currentPlan: PlanDto | undefined,
  now: string,
): RecordPaymentPreview => {
  const base =
    subscription.paidThroughAt && subscription.paidThroughAt > now
      ? subscription.paidThroughAt
      : now;
  const newPaidThrough = addMonth(base);
  return {
    periodLabel: `${humanDate(base)} – ${humanDate(newPaidThrough)}`,
    amountLabel: currentPlan?.price
      ? money(currentPlan.price.amountCents)
      : '—',
    newPaidThrough: dateOnly(newPaidThrough),
  };
};
