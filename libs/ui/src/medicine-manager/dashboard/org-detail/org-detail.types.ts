/**
 * UI-local types for the Customer (Org) Detail screen — decoupled from
 * application DTOs so wiring maps INTO them (zero-rework). Import-free.
 *
 * Data source (already in the model, no impersonation): staff hold
 * `members.read` at `any` scope → `listMembers(accountId)` returns the roster.
 * Impersonation (`customer.read`, grant-only) is a SEPARATE, optional action.
 */

export type OrgStatus = 'active' | 'disabled' | 'blocked';
export type OrgMemberStatus = 'active' | 'blocked' | 'root';

/** Derived subscription phase (ADR-0016, Stripe vocabulary) — never stored. */
export type SubscriptionPhase = 'trialing' | 'active' | 'past_due' | 'canceled';

/** Billing block for one org — all fields precomputed (incl. `overLimit`). */
export type OrgSubscriptionVM = {
  /** Customer-facing plan `displayName` (never the stable `key`). */
  readonly planName: string;
  readonly phase: SubscriptionPhase;
  readonly trialEndsAt: string | null;
  readonly paidThroughAt: string | null;
  readonly seatsUsed: number;
  /** `maxMembersPerOrg`; null = unlimited. */
  readonly seatsMax: number | null;
  /** Over-limit orgs (e.g. 5/3 after a downgrade) are legal — flagged, not fixed. */
  readonly overLimit: boolean;
  /** Formatted price, or null = the plan's price is not decided yet. */
  readonly priceLabel: string | null;
};

/** One selectable plan in the change-plan dialog (an ADR-0016 catalog row). */
export type PlanOption = {
  readonly planId: string;
  /** Customer-facing `displayName` (never the stable `key`). */
  readonly label: string;
  /** `visibility: hidden` — staff-assign only (legacy / custom plans). */
  readonly hidden: boolean;
  /** Formatted price, or null = the plan's price is not decided yet. */
  readonly priceLabel: string | null;
  /** The org's current plan — shown as a marker, not selectable. */
  readonly current: boolean;
};

/** Which billing lever dialog is open — DATA on the VM, never view state. */
export type BillingDialogVM =
  | { readonly kind: 'change-plan'; readonly options: readonly PlanOption[] }
  | { readonly kind: 'mark-paid' }
  | { readonly kind: 'extend-trial' };

export type OrgMemberRow = {
  readonly membershipId: string;
  /** Display name — wiring maps `userId` → profile. */
  readonly name: string;
  readonly email: string;
  /** Role name — wiring maps `roleIds` → the org's role. */
  readonly role: string;
  /** Holds the owner role / `isAccountOwner`. */
  readonly isOwner: boolean;
  readonly status: OrgMemberStatus;
};

export type OrgDetailVM = {
  readonly accountId: string;
  readonly name: string;
  readonly email?: string;
  readonly status: OrgStatus;
  readonly createdAt: string;
  readonly owner?: { readonly name: string; readonly email?: string };
  /** Staff holds `members.read` (any) → the roster is visible (not a grant). */
  readonly canViewMembers: boolean;
  /** An active `customer.read` grant → offer "view as customer" (impersonation). */
  readonly canImpersonate: boolean;
  /** The org's billing block (ADR-0016); absent while loading / on error. */
  readonly subscription?: OrgSubscriptionVM | undefined;
  /** Staff levers (mark paid / extend trial / change plan) are offered. */
  readonly canManageBilling: boolean;
  /** The open billing lever dialog, if any — dialog state is VM data. */
  readonly billingDialog?: BillingDialogVM | undefined;
  readonly members: readonly OrgMemberRow[];
  readonly loading: boolean;
  readonly error?: string;
};

export type OrgDetailActions = {
  /** Back to the directory (customers tab). */
  readonly onBack: () => void;
  /** Start "view as customer" — impersonation, separate from the roster read. */
  readonly onImpersonate: () => void;
  /** Staff billing levers — REQUEST opening the matching dialog. */
  readonly onMarkPaid: () => void;
  readonly onExtendTrial: () => void;
  readonly onChangePlan: () => void;
  /** Close the open billing lever dialog (Cancel / X / overlay). */
  readonly onCloseBillingDialog: () => void;
  /** Submit levers — ABSOLUTE setters (ADR-0016) with a mandatory reason. */
  readonly onSubmitChangePlan: (planId: string, reason: string) => void;
  readonly onSubmitMarkPaid: (paidThrough: string, reason: string) => void;
  readonly onSubmitExtendTrial: (trialEndsAt: string, reason: string) => void;
};
