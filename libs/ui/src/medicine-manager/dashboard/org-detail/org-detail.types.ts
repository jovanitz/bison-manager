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

/**
 * Product-visible subscription phase (draft). Maps from the domain's derived
 * phase at wiring time: `grace` = trial/period ended, unpaid, service STILL ON
 * (countdown to suspend); `suspended` = grace elapsed, service OFF, recoverable
 * anytime by paying — there is NO auto-cancel. `canceled` = explicit cancel only.
 */
export type SubscriptionPhase =
  | 'trialing'
  | 'active'
  | 'grace'
  | 'suspended'
  | 'canceled';

/** The org's outstanding balance, derived from the ledger (ADR-0018). */
export type OrgBalance = {
  /** Absolute amount, formatted (e.g. "$56.84"). */
  readonly label: string;
  /** owes = customer owes us; clear = paid up; credit = prepaid (we owe them). */
  readonly state: 'owes' | 'clear' | 'credit';
};

/** Billing block for one org — all fields precomputed (incl. `overLimit`). */
export type OrgSubscriptionVM = {
  /** Customer-facing plan `displayName` (never the stable `key`). */
  readonly planName: string;
  readonly phase: SubscriptionPhase;
  readonly trialEndsAt: string | null;
  readonly paidThroughAt: string | null;
  /** `grace` only — when service is cut if still unpaid (drives the countdown). */
  readonly graceEndsAt?: string | null;
  /** `suspended` only — when service was cut (drives "off for N days"). */
  readonly suspendedSince?: string | null;
  /** Suspended ~3+ months, idle → flagged for manual deletion review (not auto). */
  readonly dormant?: boolean;
  readonly seatsUsed: number;
  /** `maxMembersPerOrg`; null = unlimited. */
  readonly seatsMax: number | null;
  /** Over-limit orgs (e.g. 5/3 after a downgrade) are legal — flagged, not fixed. */
  readonly overLimit: boolean;
  /** Formatted price, or null = the plan's price is not decided yet. */
  readonly priceLabel: string | null;
  /** Outstanding balance derived from the ledger — absent with no charges yet. */
  readonly balance?: OrgBalance | undefined;
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

/**
 * Computed preview for the record-payment dialog. The resulting coverage is
 * DERIVED by policy (renewal anchored to the due day ± credit for downtime),
 * never a free date typed by staff — so the dialog shows it read-only.
 */
export type RecordPaymentPreview = {
  /** The period this payment covers, e.g. "5 Jul – 5 Aug 2026". */
  readonly periodLabel: string;
  readonly amountLabel: string;
  /** Resulting paid-through (ISO) — computed, shown read-only. */
  readonly newPaidThrough: string;
  /** Set when reactivating from suspension — the downtime credited forward. */
  readonly creditNote?: string;
};

/** Which billing lever dialog is open — DATA on the VM, never view state. */
export type BillingDialogVM =
  | { readonly kind: 'change-plan'; readonly options: readonly PlanOption[] }
  | { readonly kind: 'mark-paid'; readonly preview: RecordPaymentPreview }
  | { readonly kind: 'extend-trial' };

/** A charge's settlement state (ADR-0018). */
export type ChargeStatus = 'open' | 'paid' | 'void';

/** What a ledger movement is: a `charge` bills a period; `payment`/`credit` add
 *  funds; `refund` returns money; `void` reverses a mistaken movement. */
export type LedgerEntryKind =
  | 'charge'
  | 'payment'
  | 'refund'
  | 'void'
  | 'credit';

/**
 * One movement in the org's billing ledger (ADR-0018 — the source of truth;
 * coverage and balance are derived from these, never stored). All display
 * fields are precomputed at wiring time.
 */
export type OrgLedgerEntry = {
  readonly id: string;
  /** A charge's due date, or the movement's date. */
  readonly date: string;
  readonly kind: LedgerEntryKind;
  /** e.g. "Jul 2026" (charge), "Payment received", "Refund", "Void". */
  readonly description: string;
  /** Signed + formatted, e.g. "+$56.84" (billed) / "−$56.84" (paid). */
  readonly amountLabel: string;
  /** Running account balance right after this movement, formatted. */
  readonly balanceLabel: string;
  /** Charges only — open / paid / void. */
  readonly chargeStatus?: ChargeStatus | undefined;
  /** Charges only — the tax split, e.g. "$49.00 + $7.84 IVA". */
  readonly taxNote?: string | undefined;
  /** Corrections (void / refund) carry the mandatory reason. */
  readonly reason?: string | undefined;
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
  /** The org's billing ledger — absent hides the Ledger card. */
  readonly ledger?: readonly OrgLedgerEntry[] | undefined;
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
  /** Reverse a mistaken payment — it never really happened (ADR-0018 void). */
  readonly onVoidPayment: (entryId: string, reason: string) => void;
  /** Return money actually paid back to the customer (ADR-0018 refund). */
  readonly onRefundPayment: (entryId: string, reason: string) => void;
};
