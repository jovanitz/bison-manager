import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type BillingGateway,
  type MembersUseCases,
  type OrgDetailGateway,
  loadOrgDetail,
} from '@acme/application';
import type { BillingDialogVM, OrgDetailVM } from '../org-detail.types';
import { toOrgDetailVM } from './org-detail-vm';
import {
  buildChangePlanOptions,
  buildRecordPaymentPreview,
} from './org-detail-dialogs';

/**
 * Reactive store for the org-detail drill-down (ADR-0017 giro-owned). Thin:
 * `load` runs the headless `loadOrgDetail` flow + maps it; dispatchers call the
 * billing / member gateways and reload. The ephemeral panel state (`openMember`,
 * `billingDialog`) is VM DATA per the types, so the store overlays it onto the
 * mapped VM. Mirrors `directory-store.ts`.
 */
export type OrgDetailStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly orgs: OrgDetailGateway;
  readonly billing: BillingGateway;
  readonly members: Pick<MembersUseCases, 'setMemberBlocked'>;
};

export type OrgDetailStoreState = {
  readonly vm: OrgDetailVM | null;
  readonly error: string | null;
  readonly load: () => Promise<void>;
  readonly voidPayment: (paymentId: string, reason: string) => Promise<void>;
  readonly refundPayment: (paymentId: string, reason: string) => Promise<void>;
  readonly blockMember: (
    membershipId: string,
    blocked: boolean,
  ) => Promise<void>;
  readonly markPaid: (paidThrough: string, reason: string) => Promise<void>;
  readonly extendTrial: (trialEndsAt: string, reason: string) => Promise<void>;
  readonly changePlan: (planId: string, reason: string) => Promise<void>;
  readonly openMember: (membershipId: string) => void;
  readonly closeMember: () => void;
  readonly openMarkPaid: () => Promise<void>;
  readonly openExtendTrial: () => void;
  readonly openChangePlan: () => Promise<void>;
  readonly closeDialog: () => void;
};

/** The mutable, non-reactive panel state the store overlays onto the mapped VM. */
type Panel = {
  base: OrgDetailVM | null;
  openMemberId: string | null;
  dialog: BillingDialogVM | null;
};

const overlay = (panel: Panel): OrgDetailVM | null => {
  if (!panel.base) return null;
  const openMember = panel.openMemberId
    ? panel.base.members.find((m) => m.membershipId === panel.openMemberId)
    : undefined;
  return {
    ...panel.base,
    ...(openMember ? { openMember } : {}),
    ...(panel.dialog ? { billingDialog: panel.dialog } : {}),
  };
};

/** The async dialog-openers (they fetch the plan catalog), split out to keep the
 *  store factory within the function-size cap. */
const dialogOpeners = (
  deps: OrgDetailStoreDeps,
  panel: Panel,
  get: () => OrgDetailStoreState,
  emit: () => void,
) => ({
  openMarkPaid: async (): Promise<void> => {
    const sub = get().vm?.subscription;
    if (!sub) return;
    const plans = await deps.billing.listPlans();
    const current = plans.ok
      ? plans.value.find((p) => p.displayName === sub.planName)
      : undefined;
    panel.dialog = {
      kind: 'mark-paid',
      preview: buildRecordPaymentPreview(
        sub,
        current,
        new Date().toISOString(),
      ),
    };
    emit();
  },
  openChangePlan: async (): Promise<void> => {
    const plans = await deps.billing.listPlans();
    panel.dialog = {
      kind: 'change-plan',
      options: plans.ok
        ? buildChangePlanOptions(
            plans.value,
            get().vm?.subscription?.planName ?? '',
          )
        : [],
    };
    emit();
  },
});

export const createOrgDetailStore = (
  deps: OrgDetailStoreDeps,
  accountId: string,
) =>
  createStore<OrgDetailStoreState>((set, get) => {
    const panel: Panel = { base: null, openMemberId: null, dialog: null };
    const emit = () => set({ vm: overlay(panel) });
    const reload = async () => {
      const result = await loadOrgDetail(deps, { accountId });
      if (!result.ok) return set({ error: result.error.message });
      panel.base = toOrgDetailVM(result.value);
      emit();
    };
    /** Run a gateway command, then close any dialog + reload. */
    const run = async (op: Promise<{ readonly ok: boolean }>) => {
      const result = await op;
      if (!result.ok)
        return set({ error: 'The action could not be completed.' });
      panel.dialog = null;
      await reload();
    };
    const openers = dialogOpeners(deps, panel, get, emit);

    return {
      vm: null,
      error: null,
      load: reload,
      voidPayment: (paymentId, reason) =>
        run(deps.billing.voidPayment({ paymentId, reason })),
      refundPayment: (paymentId, reason) =>
        run(deps.billing.refundPayment({ paymentId, reason })),
      blockMember: (membershipId, blocked) =>
        run(deps.members.setMemberBlocked({ membershipId, blocked })),
      markPaid: (paidThrough, reason) =>
        run(deps.billing.markPaid({ accountId, paidThrough, reason })),
      extendTrial: (trialEndsAt, reason) =>
        run(deps.billing.extendTrial({ accountId, trialEndsAt, reason })),
      changePlan: (planId, reason) =>
        run(deps.billing.changePlan({ accountId, planId, reason })),
      openMember: (membershipId) => {
        panel.openMemberId = membershipId;
        emit();
      },
      closeMember: () => {
        panel.openMemberId = null;
        emit();
      },
      openExtendTrial: () => {
        panel.dialog = { kind: 'extend-trial' };
        emit();
      },
      openMarkPaid: openers.openMarkPaid,
      openChangePlan: openers.openChangePlan,
      closeDialog: () => {
        panel.dialog = null;
        emit();
      },
    };
  });

export type OrgDetailStore = ReturnType<typeof createOrgDetailStore>;
