import type { BlastRadiusVM, PlanDraft, PlanRow, PlansVM } from './plans.types';
import { planChangeLines, priceRaised } from './review/diff';

const proPlan: PlanRow = {
  planId: 'plan_2',
  key: 'pro',
  displayName: 'Pro',
  internalNote: 'The standard paid tier.',
  status: 'active',
  visibility: 'public',
  isDefault: false,
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  trialMonths: 1,
  maxOrganizationsOwned: 3,
  maxMembersPerOrg: 25,
  features: ['reports.advanced', 'export.csv', 'branding.custom'],
  subscribers: 37,
};

const plans: readonly PlanRow[] = [
  {
    planId: 'plan_1',
    key: 'free',
    displayName: 'Free',
    internalNote: 'The acquisition plan — every new org is born here.',
    status: 'active',
    visibility: 'public',
    isDefault: true,
    price: null,
    trialMonths: 3,
    maxOrganizationsOwned: 1,
    maxMembersPerOrg: 3,
    features: [],
    subscribers: 214,
  },
  proPlan,
  {
    planId: 'plan_3',
    key: 'pro-legacy',
    displayName: 'Pro',
    internalNote:
      'Old Pro terms for customers hurt by the 2026-05 seat change — staff-assign only, never public.',
    status: 'active',
    visibility: 'hidden',
    isDefault: false,
    price: { amountCents: 39900, currency: 'MXN', interval: 'month' },
    trialMonths: 1,
    maxOrganizationsOwned: 3,
    maxMembersPerOrg: 50,
    features: ['reports.advanced', 'export.csv'],
    subscribers: 6,
  },
  {
    planId: 'plan_4',
    key: 'clinica-del-valle-custom',
    displayName: 'Pro',
    internalNote:
      'Custom deal for Clínica del Valle — 5 branches, unlimited seats, one bill.',
    status: 'active',
    visibility: 'hidden',
    isDefault: false,
    price: { amountCents: 129900, currency: 'MXN', interval: 'month' },
    trialMonths: 0,
    maxOrganizationsOwned: 5,
    maxMembersPerOrg: null,
    features: ['reports.advanced', 'export.csv', 'branding.custom'],
    subscribers: 1,
  },
  {
    planId: 'plan_5',
    key: 'promo-verano-2026',
    displayName: 'Pro Verano',
    internalNote:
      'Summer 2026 acquisition promo — retired, closed to all new subscriptions.',
    status: 'retired',
    visibility: 'public',
    isDefault: false,
    price: { amountCents: 29900, currency: 'MXN', interval: 'month' },
    trialMonths: 6,
    maxOrganizationsOwned: 3,
    maxMembersPerOrg: 25,
    features: ['reports.advanced', 'export.csv'],
    subscribers: 12,
  },
];

/** Staff with `plans.manage` — the full catalog, hidden and retired included. */
export const plansVM: PlansVM = {
  plans,
  loading: false,
  canManage: true,
};

export const loadingVM: PlansVM = {
  plans: [],
  loading: true,
  canManage: true,
};

export const errorVM: PlansVM = {
  plans: [],
  loading: false,
  canManage: true,
  error: 'Could not reach the billing service.',
};

/** An edit to "Pro" awaiting the review gate: a price raise + a tighter seat
 *  limit + a dropped feature — so every consequence callout is exercised. */
export const blastRadiusVM: PlansVM = {
  ...plansVM,
  pendingEdit: {
    planName: 'Pro',
    subscribers: 37,
    changes: [
      { label: 'Price', before: '499 MXN/mo', after: '599 MXN/mo' },
      { label: 'Max members per org', before: '25', after: '15' },
      { label: 'Features', before: '3 included', after: '2 included' },
    ],
    wouldGoOverLimit: 4,
    wouldLoseFeature: 2,
    priceRaised: true,
  },
};

/** A blank draft — what "Create plan" opens with. */
export const emptyDraft: PlanDraft = {
  displayName: '',
  key: '',
  internalNote: '',
  visibility: 'public',
  price: null,
  trialMonths: 0,
  maxOrganizationsOwned: null,
  maxMembersPerOrg: null,
  features: [],
};

/** Seed an edit draft from a catalog row (pure mapper — wiring reuses it). */
export const draftFromPlan = (plan: PlanRow): PlanDraft => ({
  displayName: plan.displayName,
  key: plan.key,
  internalNote: plan.internalNote,
  visibility: plan.visibility,
  price: plan.price,
  trialMonths: plan.trialMonths,
  maxOrganizationsOwned: plan.maxOrganizationsOwned,
  maxMembersPerOrg: plan.maxMembersPerOrg,
  features: plan.features,
});

const tightened = (before: number | null, after: number | null): boolean =>
  after !== null && (before === null || after < before);

/**
 * Build the review VM for a demo edit. The before→after diff is real
 * (planChangeLines); the over-limit / lose-feature counts are backend truth in
 * production, faked here proportional to the actual edit so the prototype and
 * stories stay self-consistent (a rename shows no impact; a tighter limit does).
 */
export const demoBlast = (
  plan: PlanRow | undefined,
  draft: PlanDraft,
): BlastRadiusVM => {
  if (!plan) {
    return {
      planName: draft.displayName,
      subscribers: 0,
      changes: [],
      wouldGoOverLimit: 0,
      wouldLoseFeature: 0,
      priceRaised: false,
    };
  }
  const subs = plan.subscribers;
  const droppedFeature = plan.features.some((f) => !draft.features.includes(f));
  const tighter =
    tightened(plan.maxOrganizationsOwned, draft.maxOrganizationsOwned) ||
    tightened(plan.maxMembersPerOrg, draft.maxMembersPerOrg);
  return {
    planName: draft.displayName,
    subscribers: subs,
    changes: planChangeLines(plan, draft),
    wouldGoOverLimit: tighter ? Math.max(1, Math.round(subs * 0.1)) : 0,
    wouldLoseFeature: droppedFeature ? Math.max(1, Math.round(subs * 0.05)) : 0,
    priceRaised: priceRaised(plan.price, draft.price),
  };
};

/** The create form open on a blank draft. */
export const formCreateVM: PlansVM = {
  ...plansVM,
  form: { mode: 'create', planId: null, draft: emptyDraft },
};

/** The edit form open, seeded from "Pro" (key read-only, reach visible). */
export const formEditVM: PlansVM = {
  ...plansVM,
  form: {
    mode: 'edit',
    planId: proPlan.planId,
    draft: draftFromPlan(proPlan),
    subscribers: proPlan.subscribers,
  },
};

/** Retiring the hidden legacy plan — closing it to new subs, even staff. */
export const retireVM: PlansVM = {
  ...plansVM,
  pendingRetire: { planId: 'plan_3', displayName: 'Pro', subscribers: 6 },
};

/** Resetting the (active, public) Pro plan to its code-floor defaults. */
export const resetVM: PlansVM = {
  ...plansVM,
  pendingReset: { planId: 'plan_2', displayName: 'Pro', subscribers: 37 },
};

/** Making the (active, public) Pro plan the default — replacing Free. */
export const setDefaultVM: PlansVM = {
  ...plansVM,
  pendingSetDefault: {
    planId: 'plan_2',
    displayName: 'Pro',
    currentDefaultName: 'Free',
  },
};
