/**
 * Pure, framework-free helpers for the plans create/edit form — extracted from
 * plans.types.ts so that file stays a thin type contract (and both keep under
 * the file-size caps). Imports only the VM types.
 */
import type { PlanDraft, PlanPrice } from '../plans.types';

/** Stable key auto-derived from the display name — staff never types keys. */
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');

/**
 * The closed feature union the form offers — plans combine capabilities the
 * code enforces; creating a plan cannot invent functionality. Keys are
 * NAMESPACED (`group.feature`), which is what lets the picker UI scale:
 * grouping and search derive from the key itself, no extra catalog needed.
 */
export const KNOWN_FEATURES: readonly string[] = [
  'reports.advanced',
  'reports.scheduled',
  'export.csv',
  'export.pdf',
  'branding.custom',
  'branding.domain',
  'audit.export',
  'audit.retention-1y',
  'members.bulk-import',
  'api.access',
  'integrations.whatsapp',
  'support.priority',
];

export type FeatureGroup = {
  readonly name: string;
  readonly keys: readonly string[];
};

/** Group namespaced keys by prefix, filtered by a search query. Pure. */
export const featureGroups = (
  keys: readonly string[],
  query: string,
): readonly FeatureGroup[] => {
  const q = query.trim().toLowerCase();
  const hits = keys.filter((k) => k.toLowerCase().includes(q));
  const prefixes = [...new Set(hits.map((k) => k.split('.')[0] ?? k))];
  return prefixes.map((prefix) => ({
    // Short prefixes are acronyms (api → API); the rest just capitalize.
    name:
      prefix.length <= 3
        ? prefix.toUpperCase()
        : prefix.charAt(0).toUpperCase() + prefix.slice(1),
    keys: hits.filter((k) => (k.split('.')[0] ?? k) === prefix),
  }));
};

type Ev = { readonly target: { readonly value: string } };

const int = (v: string) => Math.max(0, Math.trunc(Number(v) || 0));

export const asInterval = (v: string) => (v === 'year' ? 'year' : 'month');

export const toggle = (list: readonly string[], f: string, on: boolean) =>
  on ? [...list, f] : list.filter((x) => x !== f);

export const noPrice = (none: boolean): PlanPrice | null =>
  none ? null : { amountCents: 0, currency: 'MXN', interval: 'month' };

/** Controlled text-input props: value + onChange in one spread. */
export const text = (value: string, set: (v: string) => void) => ({
  value,
  onChange: (e: Ev) => set(e.target.value),
});

/** Controlled non-negative-integer input props. */
export const num = (value: number, set: (v: number) => void) => ({
  type: 'number' as const,
  min: 0,
  value,
  onChange: (e: Ev) => set(int(e.target.value)),
});

/**
 * Form submit gate: name + note required, and a present price must be > 0 — a
 * decided price of $0 is NOT "no price yet" (`price: null`), the only state the
 * ADR exempts from delinquency blocking.
 */
export const draftInvalid = (d: PlanDraft) =>
  !d.displayName.trim() ||
  !d.internalNote.trim() ||
  (d.price !== null && d.price.amountCents <= 0);
