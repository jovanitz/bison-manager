import type {
  BillingSummaryDto,
  LedgerEntryDto,
  LedgerViewDto,
  OrgDetailViewModel,
  OrgMemberDto,
} from '@acme/application';
import type {
  OrgBalance,
  OrgDetailVM,
  OrgLedgerEntry,
  OrgMemberRow,
  OrgStatus,
  OrgSubscriptionVM,
  SubscriptionPhase,
} from '../org-detail.types';

/**
 * Pure mapper: the application `OrgDetailViewModel` (+ its ledger) → the UI
 * `OrgDetailVM`. All display strings are precomputed here (money, dates,
 * ledger labels, the 4→5 billing-phase translation), so the view stays a dumb
 * render. Ephemeral panel state (`openMember` / `billingDialog`) is NOT set here
 * — the store overlays it. Mirrors `directory-vm.ts`.
 */
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

/** Absolute, formatted: 5684 → "$56.84". */
const money = (minor: number): string =>
  '$' +
  (Math.abs(minor) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Signed from the customer-owes view: +5684 → "+$56.84", −5684 → "−$56.84". */
const signedMoney = (minor: number): string =>
  (minor >= 0 ? '+' : '−') + money(minor);

const dateOnly = (iso: string): string => iso.slice(0, 10);

const monthYear = (iso: string): string => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()] ?? '?'} ${d.getUTCFullYear()}`;
};

const ledgerDescription = (e: LedgerEntryDto): string => {
  if (e.kind === 'charge') return monthYear(e.period?.from ?? e.date);
  if (e.kind === 'payment') return 'Payment received';
  if (e.kind === 'credit') return 'Credit';
  return e.kind === 'refund' ? 'Refund · payment' : 'Void · payment';
};

const taxNote = (e: LedgerEntryDto): string | undefined =>
  e.subtotalMinor !== undefined && e.taxMinor !== undefined
    ? `${money(e.subtotalMinor)} + ${money(e.taxMinor)} IVA`
    : undefined;

const toLedgerEntry = (e: LedgerEntryDto): OrgLedgerEntry => {
  const note = taxNote(e);
  return {
    id: e.id,
    date: dateOnly(e.date),
    kind: e.kind,
    description: ledgerDescription(e),
    amountLabel: signedMoney(e.amountMinor),
    balanceLabel: money(e.runningBalanceMinor),
    ...(e.chargeStatus ? { chargeStatus: e.chargeStatus } : {}),
    ...(note ? { taxNote: note } : {}),
    ...(e.reason ? { reason: e.reason } : {}),
  };
};

/** The read-model is chronological; the card shows newest-first. */
const toLedgerRows = (ledger: LedgerViewDto): readonly OrgLedgerEntry[] =>
  [...ledger.entries].reverse().map(toLedgerEntry);

const balanceState = (minor: number): OrgBalance['state'] => {
  if (minor > 0) return 'owes';
  return minor < 0 ? 'credit' : 'clear';
};

const toBalance = (minor: number): OrgBalance => ({
  label: money(minor),
  state: balanceState(minor),
});

/** 4-state API phase → 5-state product phase: past-due splits on the hold
 *  (service cut = suspended; still on = grace). */
const toPhase = (phase: string, held: boolean): SubscriptionPhase => {
  if (phase === 'trialing' || phase === 'active' || phase === 'canceled')
    return phase;
  return held ? 'suspended' : 'grace';
};

const priceLabel = (price: BillingSummaryDto['price']): string | null =>
  price ? `$${price.amountCents / 100} / ${price.interval}` : null;

const toSubscriptionVM = (
  summary: BillingSummaryDto,
  balance: OrgBalance | undefined,
): OrgSubscriptionVM => ({
  planName: summary.planName,
  phase: toPhase(summary.phase, summary.heldForPayment),
  trialEndsAt: summary.trialEndsAt ? dateOnly(summary.trialEndsAt) : null,
  paidThroughAt: summary.paidThroughAt ? dateOnly(summary.paidThroughAt) : null,
  seatsUsed: summary.seats.used,
  seatsMax: summary.seats.max,
  overLimit: summary.overLimit,
  priceLabel: priceLabel(summary.price),
  ...(balance ? { balance } : {}),
});

const toMemberRow = (m: OrgMemberDto): OrgMemberRow => ({
  membershipId: m.membershipId,
  userId: m.userId,
  name: m.displayName ?? m.email ?? m.userId,
  email: m.email ?? '',
  role: m.roleNames[0] ?? 'Member',
  isOwner: m.isAccountOwner,
  // The roster read carries no join date yet — display-only, left blank.
  joinedAt: '',
  ...(m.isRoot ? { isRoot: true } : {}),
  ...(m.blocked ? { blocked: true } : {}),
});

const STATUS: Record<string, OrgStatus> = {
  active: 'active',
  disabled: 'disabled',
  blocked: 'blocked',
};

export const toOrgDetailVM = (rm: OrgDetailViewModel): OrgDetailVM => {
  const last = rm.ledger?.entries.at(-1);
  const balance = last ? toBalance(last.runningBalanceMinor) : undefined;
  return {
    accountId: rm.accountId,
    name: rm.name,
    status: STATUS[rm.status] ?? 'active',
    createdAt: dateOnly(rm.createdAt),
    canViewMembers: rm.canViewMembers,
    canManageMembers: rm.canManageMembers,
    // Impersonation ("view as customer") is a separate session-switch feature,
    // not wired here — never offer the button from this screen yet.
    canImpersonate: false,
    canManageBilling: rm.canManageBilling,
    members: rm.members.map(toMemberRow),
    loading: false,
    ...(rm.email ? { email: rm.email } : {}),
    ...(rm.owner
      ? {
          owner: {
            name: rm.owner.name,
            ...(rm.owner.email ? { email: rm.owner.email } : {}),
          },
        }
      : {}),
    ...(rm.subscription
      ? { subscription: toSubscriptionVM(rm.subscription, balance) }
      : {}),
    ...(rm.ledger ? { ledger: toLedgerRows(rm.ledger) } : {}),
  };
};
