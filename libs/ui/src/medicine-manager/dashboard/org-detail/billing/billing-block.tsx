/**
 * Billing block for the Org Detail view (ADR-0018) — the subscription card plus
 * the ledger, both optional. Extracted from the view so it stays a thin
 * composition, and grouped with the other billing pieces.
 */
import { SubscriptionCard } from '../org-detail.subscription';
import { LedgerCard } from '../ledger/ledger';
import type { OrgDetailActions, OrgDetailVM } from '../org-detail.types';

export const BillingBlock = ({
  vm,
  onMarkPaid,
  onExtendTrial,
  onChangePlan,
  onVoidPayment,
  onRefundPayment,
}: { readonly vm: OrgDetailVM } & Pick<
  OrgDetailActions,
  | 'onMarkPaid'
  | 'onExtendTrial'
  | 'onChangePlan'
  | 'onVoidPayment'
  | 'onRefundPayment'
>) => (
  <>
    {vm.subscription ? (
      <SubscriptionCard
        subscription={vm.subscription}
        canManageBilling={vm.canManageBilling}
        onMarkPaid={onMarkPaid}
        onExtendTrial={onExtendTrial}
        onChangePlan={onChangePlan}
      />
    ) : null}
    {vm.ledger ? (
      <LedgerCard
        ledger={vm.ledger}
        balance={vm.subscription?.balance}
        canManageBilling={vm.canManageBilling}
        onVoidPayment={onVoidPayment}
        onRefundPayment={onRefundPayment}
      />
    ) : null}
  </>
);
