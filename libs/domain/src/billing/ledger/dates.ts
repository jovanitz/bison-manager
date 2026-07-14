/** Pure UTC date helpers for the ledger (ADR-0018). Date-only or full ISO. */

const DAY_MS = 86_400_000;
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/;

export const isIsoDate = (value: string): boolean =>
  ISO_DATE_SHAPE.test(value) && !Number.isNaN(new Date(value).getTime());

export const addDays = (iso: string, days: number): string => {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
};

/** Whole days from `from` to `to` (negative if `to` precedes `from`). */
export const daysBetween = (from: string, to: string): number =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);

export const isBefore = (a: string, b: string): boolean =>
  new Date(a).getTime() < new Date(b).getTime();
