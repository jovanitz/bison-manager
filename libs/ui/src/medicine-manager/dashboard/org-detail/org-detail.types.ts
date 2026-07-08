/**
 * UI-local types for the Customer (Org) Detail screen — decoupled from
 * application DTOs so wiring maps INTO them (zero-rework). Import-free.
 *
 * Data source (already in the model, no impersonation): staff hold
 * `members.read` at `any` scope → `listMembers(accountId)` returns the roster.
 * Impersonation (`customer.read`, grant-only) is a SEPARATE, optional action.
 */

export type OrgStatus = 'active' | 'disabled' | 'blocked';
export type OrgMemberStatus = 'active' | 'blocked' | 'disabled' | 'root';

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

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

/** One entry in the org's payment ledger (manual reconciliation, no Stripe). */
export type OrgPaymentRow = {
  readonly paymentId: string;
  /** Billing period the charge covers (e.g. "Jul 2026"). */
  readonly period: string;
  /** Preformatted amount (e.g. "$49.00"). */
  readonly amountLabel: string;
  readonly status: PaymentStatus;
  /** When it settled — null until paid. */
  readonly paidAt: string | null;
};

export type OrgMemberRow = {
  readonly membershipId: string;
  /** The user's stable identity id — shown in the detail panel. */
  readonly userId: string;
  /** Display name — wiring maps `userId` → profile. */
  readonly name: string;
  readonly email: string;
  /** Role name — wiring maps `roleIds` → the org's role. */
  readonly role: string;
  /** Holds the owner role / `isAccountOwner` — protected from block/disable. */
  readonly isOwner: boolean;
  readonly joinedAt: string;
  /** Root identity — protected: never blockable/disableable. */
  readonly isRoot?: boolean;
  /** Soft block — access to THIS org suspended, reversible (`members.block`). */
  readonly blocked?: boolean;
  /** Hard disable — the user's whole account is off (identity-level). */
  readonly disabled?: boolean;
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
  /** Staff can moderate members (block / disable) — the ⋯ menu + panel levers. */
  readonly canManageMembers: boolean;
  /** The member whose detail panel is open — panel state is VM data, not view. */
  readonly openMember?: OrgMemberRow | undefined;
  /** An active `customer.read` grant → offer "view as customer" (impersonation). */
  readonly canImpersonate: boolean;
  /** The org's billing block (ADR-0016); absent while loading / on error. */
  readonly subscription?: OrgSubscriptionVM | undefined;
  /** Staff levers (mark paid / extend trial / change plan) are offered. */
  readonly canManageBilling: boolean;
  /** The open billing lever dialog, if any — dialog state is VM data. */
  readonly billingDialog?: BillingDialogVM | undefined;
  readonly members: readonly OrgMemberRow[];
  /** The org's payment ledger — absent hides the Payments card. */
  readonly payments?: readonly OrgPaymentRow[] | undefined;
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
  /** Open a member's detail panel (id, info + moderation levers). */
  readonly onViewMember: (membershipId: string) => void;
  /** Close the member detail panel. */
  readonly onCloseMember: () => void;
  /** Soft block / unblock a member in THIS org (`members.block`). */
  readonly onBlockMember: (membershipId: string, blocked: boolean) => void;
  /** Hard disable / enable the member's whole account (identity-level). */
  readonly onSetMemberAccount: (
    userId: string,
    action: 'disable' | 'enable',
  ) => void;
  /** Reconcile a ledger entry — mark a pending/failed payment as paid. */
  readonly onMarkPaymentPaid: (paymentId: string) => void;
};
