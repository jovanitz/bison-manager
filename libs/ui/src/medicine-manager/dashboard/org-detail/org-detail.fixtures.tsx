import type {
  OrgDetailVM,
  OrgMemberRow,
  OrgSubscriptionVM,
  PlanOption,
} from './org-detail.types';

const members: readonly OrgMemberRow[] = [
  {
    membershipId: 'mem_1',
    name: 'Lucía Fuentes',
    email: 'lucia@norte.mx',
    role: 'Owner',
    isOwner: true,
    status: 'active',
  },
  {
    membershipId: 'mem_2',
    name: 'Marco Peña',
    email: 'marco@norte.mx',
    role: 'Admin',
    isOwner: false,
    status: 'active',
  },
  {
    membershipId: 'mem_3',
    name: 'Sofía Ramos',
    email: 'sofia@norte.mx',
    role: 'Member',
    isOwner: false,
    status: 'blocked',
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
  canManageBilling: false,
  members: [],
  subscription: activeSubscription,
};

/** Trial over, never paid → phase `past_due`; growth + premium are gated. */
export const trialExpiredVM: OrgDetailVM = {
  ...base,
  subscription: {
    planName: 'Free',
    phase: 'past_due',
    trialEndsAt: '2026-06-14',
    paidThroughAt: null,
    seatsUsed: 3,
    seatsMax: 3,
    overLimit: false,
    priceLabel: '$15 / month',
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

/** Change-plan dialog open over the paid Pro org. */
export const changePlanDialogVM: OrgDetailVM = {
  ...populatedVM,
  billingDialog: { kind: 'change-plan', options: changePlanOptions },
};

/** Mark-paid dialog open over the past-due org (the natural rescue lever). */
export const markPaidDialogVM: OrgDetailVM = {
  ...trialExpiredVM,
  billingDialog: { kind: 'mark-paid' },
};

/** Extend-trial dialog open over a trialing org. */
export const extendTrialDialogVM: OrgDetailVM = {
  ...base,
  subscription: trialingSubscription,
  billingDialog: { kind: 'extend-trial' },
};
