import type {
  OrgDetailVM,
  OrgMemberRow,
  OrgSubscriptionVM,
  PlanOption,
  RecordPaymentPreview,
} from './org-detail.types';

const members: readonly OrgMemberRow[] = [
  {
    membershipId: 'mem_1',
    userId: 'usr_a1f9',
    name: 'Lucía Fuentes',
    email: 'lucia@norte.mx',
    role: 'Owner',
    isOwner: true,
    joinedAt: '2026-03-14',
  },
  {
    membershipId: 'mem_2',
    userId: 'usr_b2c7',
    name: 'Marco Peña',
    email: 'marco@norte.mx',
    role: 'Admin',
    isOwner: false,
    joinedAt: '2026-04-02',
  },
  {
    membershipId: 'mem_3',
    userId: 'usr_c3d5',
    name: 'Sofía Ramos',
    email: 'sofia@norte.mx',
    role: 'Member',
    isOwner: false,
    joinedAt: '2026-05-20',
    blocked: true,
  },
];

/** A paid, healthy subscription — plenty of headroom. */
const activeSubscription: OrgSubscriptionVM = {
  planName: 'Pro',
  phase: 'active',
  trialEndsAt: null,
  paidThroughAt: '2026-12-31',
  seatsUsed: 12,
  seatsMax: 25,
  overLimit: false,
  priceLabel: '$49 / month',
  balance: { label: '$0.00', state: 'clear' },
};

/** Inside the trial window; the plan's price is not decided yet. */
const trialingSubscription: OrgSubscriptionVM = {
  planName: 'Free',
  phase: 'trialing',
  trialEndsAt: '2026-09-14',
  paidThroughAt: null,
  seatsUsed: 2,
  seatsMax: 3,
  overLimit: false,
  priceLabel: null,
};

const base: OrgDetailVM = {
  accountId: 'org_11',
  name: 'Clínica Norte',
  email: 'admin@norte.mx',
  status: 'active',
  createdAt: '2026-03-14',
  owner: { name: 'Lucía Fuentes', email: 'lucia@norte.mx' },
  canViewMembers: true,
  canManageMembers: true,
  canImpersonate: false,
  canManageBilling: true,
  members,
  loading: false,
};

/** Staff with `members.read` (any) — the roster is visible. */
export const populatedVM: OrgDetailVM = {
  ...base,
  subscription: activeSubscription,
};

/** Also holds an active `customer.read` grant → "View as customer" is offered. */
export const withImpersonationVM: OrgDetailVM = {
  ...base,
  canImpersonate: true,
  subscription: trialingSubscription,
};

/** A role without `members.read` — the roster is hidden (not a grant prompt). */
export const gatedVM: OrgDetailVM = {
  ...base,
  canViewMembers: false,
  canManageMembers: false,
  canManageBilling: false,
  members: [],
  subscription: activeSubscription,
};

/** Trial just ended, unpaid → phase `grace`: service still ON, counting down. */
export const trialExpiredVM: OrgDetailVM = {
  ...base,
  subscription: {
    planName: 'Free',
    phase: 'grace',
    trialEndsAt: '2026-07-05',
    paidThroughAt: null,
    graceEndsAt: '2026-07-15',
    seatsUsed: 3,
    seatsMax: 3,
    overLimit: false,
    priceLabel: '$15 / month',
    balance: { label: '$17.40', state: 'owes' },
  },
};

/** Grace elapsed, unpaid → phase `suspended`: service OFF, recoverable anytime.
 *  Org status stays `active` — billing suspension is a separate axis from a
 *  staff `access.block`; only the Subscription card carries the billing phase. */
export const suspendedVM: OrgDetailVM = {
  ...base,
  subscription: {
    planName: 'Pro',
    phase: 'suspended',
    trialEndsAt: '2026-05-20',
    paidThroughAt: '2026-06-05',
    suspendedSince: '2026-06-30',
    seatsUsed: 8,
    seatsMax: 25,
    overLimit: false,
    priceLabel: '$49 / month',
    balance: { label: '$56.84', state: 'owes' },
  },
};

/** Suspended 3+ months, idle → flagged dormant for manual deletion review. */
export const dormantVM: OrgDetailVM = {
  ...base,
  subscription: {
    planName: 'Pro',
    phase: 'suspended',
    trialEndsAt: '2026-02-20',
    paidThroughAt: '2026-03-05',
    suspendedSince: '2026-03-30',
    dormant: true,
    seatsUsed: 8,
    seatsMax: 25,
    overLimit: false,
    priceLabel: '$49 / month',
    balance: { label: '$56.84', state: 'owes' },
  },
};

/** Over-limit after a downgrade (5/3) — legal and visible, growth-only gating. */
export const overLimitVM: OrgDetailVM = {
  ...base,
  subscription: {
    planName: 'Free',
    phase: 'active',
    trialEndsAt: '2026-04-01',
    paidThroughAt: '2026-12-31',
    seatsUsed: 5,
    seatsMax: 3,
    overLimit: true,
    priceLabel: '$15 / month',
    balance: { label: '$0.00', state: 'clear' },
  },
};

export const loadingVM: OrgDetailVM = {
  ...base,
  loading: true,
  members: [],
};

export const errorVM: OrgDetailVM = {
  ...base,
  loading: false,
  members: [],
  error: 'Could not reach the directory service.',
};

/** Catalog options for the change-plan dialog — Pro is populatedVM's plan. */
export const changePlanOptions: readonly PlanOption[] = [
  {
    planId: 'plan_free',
    label: 'Free',
    hidden: false,
    priceLabel: null,
    current: false,
  },
  {
    planId: 'plan_pro',
    label: 'Pro',
    hidden: false,
    priceLabel: '$49 / month',
    current: true,
  },
  {
    planId: 'plan_pro_legacy',
    label: 'Pro Legacy',
    hidden: true,
    priceLabel: '$29 / month',
    current: false,
  },
  {
    planId: 'plan_clinica',
    label: 'Clínica custom',
    hidden: true,
    priceLabel: '$120 / month',
    current: false,
  },
];

/** Computed reactivation preview — the suspended org's downtime credited
 *  forward (renewal 5 Jul → 13 Jul). Staff confirm; they never type the date. */
export const recordPaymentPreview: RecordPaymentPreview = {
  periodLabel: '5 Jun – 5 Jul 2026',
  amountLabel: '$49.00',
  newPaidThrough: '2026-07-13',
  creditNote: 'Includes 8 days credited for the suspension (5 Jul → 13 Jul).',
};

/** Member detail panel open on the blocked member (offers Unblock + Disable). */
export const memberDetailVM: OrgDetailVM = {
  ...populatedVM,
  openMember: members[2],
};
