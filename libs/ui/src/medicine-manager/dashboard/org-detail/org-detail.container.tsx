import { useEffect } from 'react';
import { useOrgDetailStore, useStore } from './store/hooks';
import type { OrgDetailStore } from './store/org-detail-store';
import { OrgDetailView } from './org-detail.view';
import type { OrgDetailActions, OrgDetailVM } from './org-detail.types';
import { toast } from '../../../design-system/toast/toaster';

/**
 * The DI-bound org-detail container (ADR-0017 giro-owned). Reads the ViewModel
 * from the store and dispatches the backed actions: void/refund, the billing
 * levers (mark-paid / extend-trial / change-plan) and member block. `onBack`
 * comes from the parent (in-page master/detail, not a route). Two actions are
 * deliberately deferred and toast instead: identity-level member disable (its
 * user→account mapping is unresolved) and impersonation (a separate
 * session-switch feature; the button is also hidden via `canImpersonate`).
 */
const loadingVM = (accountId: string): OrgDetailVM => ({
  accountId,
  name: '',
  status: 'active',
  createdAt: '',
  canViewMembers: false,
  canManageMembers: false,
  canImpersonate: false,
  canManageBilling: false,
  members: [],
  loading: true,
});

const deferred = (what: string) => () =>
  toast.info(`${what} isn't available from this screen yet.`);

const buildActions = (
  store: OrgDetailStore,
  onBack: () => void,
): OrgDetailActions => ({
  onBack,
  onImpersonate: deferred('View as customer'),
  onMarkPaid: () => void store.getState().openMarkPaid(),
  onExtendTrial: () => store.getState().openExtendTrial(),
  onChangePlan: () => void store.getState().openChangePlan(),
  onCloseBillingDialog: () => store.getState().closeDialog(),
  onSubmitChangePlan: (planId, reason) =>
    void store.getState().changePlan(planId, reason),
  onSubmitMarkPaid: (paidThrough, reason) =>
    void store.getState().markPaid(paidThrough, reason),
  onSubmitExtendTrial: (trialEndsAt, reason) =>
    void store.getState().extendTrial(trialEndsAt, reason),
  onViewMember: (membershipId) => store.getState().openMember(membershipId),
  onCloseMember: () => store.getState().closeMember(),
  onBlockMember: (membershipId, blocked) =>
    void store.getState().blockMember(membershipId, blocked),
  onSetMemberAccount: deferred('Disabling a member account'),
  onVoidPayment: (entryId, reason) =>
    void store.getState().voidPayment(entryId, reason),
  onRefundPayment: (entryId, reason) =>
    void store.getState().refundPayment(entryId, reason),
});

const OrgDetailBound = ({
  store,
  accountId,
  onBack,
}: {
  readonly store: OrgDetailStore;
  readonly accountId: string;
  readonly onBack: () => void;
}) => {
  const vm = useStore(store, (s) => s.vm);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return (
    <OrgDetailView
      vm={vm ?? loadingVM(accountId)}
      {...buildActions(store, onBack)}
    />
  );
};

export const OrgDetailSection = ({
  accountId,
  onBack,
}: {
  readonly accountId: string;
  readonly onBack: () => void;
}) => {
  const store = useOrgDetailStore(accountId);
  if (!store) return null;
  return <OrgDetailBound store={store} accountId={accountId} onBack={onBack} />;
};
