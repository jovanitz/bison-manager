/**
 * UI-local types for the staff Plans catalog screen (ADR-0016) — decoupled
 * from application DTOs so wiring maps INTO them (zero-rework). Import-free.
 *
 * Vocabulary mirrors the ADR: stable `key` ≠ customer-facing `displayName`,
 * `price: null` = "not decided yet" (first-class), `null` limits = unlimited,
 * and every plan edit goes through a blast-radius preview + mandatory reason.
 */

export type PlanStatus = 'active' | 'retired';
export type PlanVisibility = 'public' | 'hidden';

export type PlanPrice = {
  readonly amountCents: number;
  readonly currency: string;
  readonly interval: 'month' | 'year';
};

export type PlanRow = {
  readonly planId: string;
  /** Stable identifier — staff-only; customers never see it. */
  readonly key: string;
  readonly displayName: string;
  /** Why this plan exists, for whom (required in the model). */
  readonly internalNote: string;
  readonly status: PlanStatus;
  readonly visibility: PlanVisibility;
  /** The singular `defaultForNewOrgs` marker. */
  readonly isDefault: boolean;
  /** null = price not decided yet. */
  readonly price: PlanPrice | null;
  readonly trialMonths: number;
  /** null = unlimited. */
  readonly maxOrganizationsOwned: number | null;
  /** null = unlimited. */
  readonly maxMembersPerOrg: number | null;
  readonly features: readonly string[];
  readonly subscribers: number;
};

/** One field's before→after in the review step — the staff sees exactly what
 *  they are about to apply, not just how many orgs it reaches. */
export type PlanChangeLine = {
  readonly label: string;
  readonly before: string;
  readonly after: string;
};

/**
 * The confirm gate on plans.update/plans.reset — the ADR-0016 "apply to all" UX.
 * `changes` is WHAT you edited (before→after); the counts are WHO it reaches;
 * `priceRaised` triggers the grandfather callout (a raise hits every subscriber
 * live — the legacy-plan playbook is the way to spare them).
 */
export type BlastRadiusVM = {
  readonly planName: string;
  readonly subscribers: number;
  readonly changes: readonly PlanChangeLine[];
  readonly wouldGoOverLimit: number;
  readonly wouldLoseFeature: number;
  readonly priceRaised: boolean;
  /** The confirm request is in flight (button spinner, inputs locked). */
  readonly confirming?: boolean | undefined;
  /** The confirm failed — shown inline so the staff can retry. */
  readonly error?: string | undefined;
};

/** What the create/edit form edits and submits. */
export type PlanDraft = {
  readonly displayName: string;
  readonly key: string;
  readonly internalNote: string;
  readonly visibility: PlanVisibility;
  readonly price: PlanPrice | null;
  readonly trialMonths: number;
  readonly maxOrganizationsOwned: number | null;
  readonly maxMembersPerOrg: number | null;
  readonly features: readonly string[];
};

/** An open create/edit form — the dialog being open is VM data. */
export type PlanFormVM = {
  readonly mode: 'create' | 'edit';
  readonly planId: string | null;
  readonly draft: PlanDraft;
  /** Edit context: how many orgs live on this plan (shown before the gate). */
  readonly subscribers?: number | undefined;
  /** Create is a backend write — the submit spins while it's in flight. */
  readonly submitting?: boolean | undefined;
  /** The create failed — shown inline so the staff can retry. */
  readonly error?: string | undefined;
};

/** Stable key auto-derived from the display name — staff never types keys. */
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');

/** Retire = closed to new subscriptions, never delete — even staff. */
export type RetireConfirmVM = {
  readonly planId: string;
  readonly displayName: string;
  readonly subscribers: number;
  /** The retire request is in flight (button spinner). */
  readonly retiring?: boolean | undefined;
  /** The retire failed — shown inline so the staff can retry. */
  readonly error?: string | undefined;
};

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

export type PlansVM = {
  readonly plans: readonly PlanRow[];
  readonly loading: boolean;
  readonly error?: string | undefined;
  /** Holds `plans.manage` — create/edit/reset/retire are offered. */
  readonly canManage: boolean;
  /** A pending edit awaiting blast-radius confirmation (dialog open). */
  readonly pendingEdit?: BlastRadiusVM | undefined;
  /** An open create/edit form dialog. */
  readonly form?: PlanFormVM | undefined;
  /** A retire awaiting its confirm dialog. */
  readonly pendingRetire?: RetireConfirmVM | undefined;
};

export type PlansActions = {
  readonly onCreate: () => void;
  readonly onEdit: (planId: string) => void;
  readonly onRetire: (planId: string) => void;
  /** Restore the code floor — a mass live-edit, same confirm gate. */
  readonly onReset: (planId: string) => void;
  readonly onConfirmEdit: (reason: string) => void;
  readonly onCancelEdit: () => void;
  /** Form submit — edit chains into the blast-radius confirm. */
  readonly onSubmitForm: (draft: PlanDraft) => void;
  readonly onCancelForm: () => void;
  readonly onConfirmRetire: () => void;
  readonly onCancelRetire: () => void;
};

/**
 * Import-free helpers + prop types for plans.form.tsx — hosted here so that
 * file stays inside the hard file-size caps. No imports, so the file keeps
 * its contract.
 */
export type PlanFormProps = { readonly form: PlanFormVM } & Pick<
  PlansActions,
  'onSubmitForm' | 'onCancelForm'
>;

export type RetireConfirmProps = {
  readonly pendingRetire: RetireConfirmVM;
} & Pick<PlansActions, 'onConfirmRetire' | 'onCancelRetire'>;

/** A partial-draft updater — what the form's controlled inputs call. */
export type Patch = (patch: Partial<PlanDraft>) => void;

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
 * Form submit gate: name + note required, and a present price must be > 0 —
 * a decided price of $0 is NOT "no price yet" (`price: null`), which is the
 * only state the ADR exempts from delinquency blocking.
 */
export const draftInvalid = (d: PlanDraft) =>
  !d.displayName.trim() ||
  !d.internalNote.trim() ||
  (d.price !== null && d.price.amountCents <= 0);
