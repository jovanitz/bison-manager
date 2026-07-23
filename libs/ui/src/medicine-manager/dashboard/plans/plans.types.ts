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
 * Reset = restore the plan to its code floor (ADR-0016). A mass live-edit in
 * disguise, so — like an edit — it is audited with a reason. There is no
 * blast-radius preview endpoint for a reset, so the confirm warns rather than
 * counts; the domain rejects a reset on a plan with no code seed.
 */
export type ResetConfirmVM = {
  readonly planId: string;
  readonly displayName: string;
  readonly subscribers: number;
  /** The reset request is in flight (button spinner). */
  readonly resetting?: boolean | undefined;
  /** The reset failed — shown inline so the staff can retry. */
  readonly error?: string | undefined;
};

/**
 * The confirm gate on plans.setDefault. LOW blast radius — it only changes which
 * plan NEW organizations start on; existing subscriptions are untouched — so no
 * over-limit/lose-feature preview is needed. But it IS audited (the model records
 * `billing.default-plan-changed`), so a reason is required, like every plan write.
 */
export type SetDefaultConfirmVM = {
  readonly planId: string;
  readonly displayName: string;
  /** The plan LOSING the default marker, if any — shown so staff see the swap. */
  readonly currentDefaultName: string | null;
  /** The request is in flight (button spinner, inputs locked). */
  readonly setting?: boolean | undefined;
  /** The set-default failed — shown inline so the staff can retry. */
  readonly error?: string | undefined;
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
  /** A reset-to-defaults awaiting its confirm dialog. */
  readonly pendingReset?: ResetConfirmVM | undefined;
  /** A set-as-default awaiting its confirm dialog. */
  readonly pendingSetDefault?: SetDefaultConfirmVM | undefined;
};

export type PlansActions = {
  readonly onCreate: () => void;
  readonly onEdit: (planId: string) => void;
  readonly onRetire: (planId: string) => void;
  /** Restore the code floor — a mass live-edit, same confirm gate. */
  readonly onReset: (planId: string) => void;
  /** Make a plan the default for NEW orgs — opens its (reason) confirm. */
  readonly onSetDefault: (planId: string) => void;
  readonly onConfirmSetDefault: (reason: string) => void;
  readonly onCancelSetDefault: () => void;
  readonly onConfirmEdit: (reason: string) => void;
  readonly onCancelEdit: () => void;
  /** Reset commits with an audited reason — opens its confirm. */
  readonly onConfirmReset: (reason: string) => void;
  readonly onCancelReset: () => void;
  /**
   * Form submit. On create the reason is collected in the form (there is no
   * second gate), so it rides along; on edit it is `undefined` — the reason is
   * gathered later at the blast-radius confirm (`onConfirmEdit`).
   */
  readonly onSubmitForm: (draft: PlanDraft, reason?: string) => void;
  readonly onCancelForm: () => void;
  readonly onConfirmRetire: (reason: string) => void;
  readonly onCancelRetire: () => void;
};

/** Prop types for the form + confirm dialogs (helpers → plans.form.helpers.ts). */
export type PlanFormProps = { readonly form: PlanFormVM } & Pick<
  PlansActions,
  'onSubmitForm' | 'onCancelForm'
>;

export type RetireConfirmProps = {
  readonly pendingRetire: RetireConfirmVM;
} & Pick<PlansActions, 'onConfirmRetire' | 'onCancelRetire'>;

export type ResetConfirmProps = {
  readonly pendingReset: ResetConfirmVM;
} & Pick<PlansActions, 'onConfirmReset' | 'onCancelReset'>;

export type SetDefaultConfirmProps = {
  readonly pendingSetDefault: SetDefaultConfirmVM;
} & Pick<PlansActions, 'onConfirmSetDefault' | 'onCancelSetDefault'>;

/** A partial-draft updater — what the form's controlled inputs call. */
export type Patch = (patch: Partial<PlanDraft>) => void;
