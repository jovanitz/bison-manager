import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OrgDetailView } from './org-detail.view';
import type { BillingDialogVM, OrgDetailVM } from './org-detail.types';
import {
  populatedVM,
  withImpersonationVM,
  gatedVM,
  trialExpiredVM,
  suspendedVM,
  dormantVM,
  overLimitVM,
  loadingVM,
  errorVM,
  changePlanOptions,
  recordPaymentPreview,
  memberDetailVM,
} from './org-detail.fixtures';
import { DashboardShell } from '../dashboard.shell';
import { demoLedger, demoLedgerOwing } from './ledger/ledger.fixtures';

const meta: Meta<typeof OrgDetailView> = {
  title: 'Medicine Manager/Dashboard/Org Detail',
  component: OrgDetailView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof OrgDetailView>;

const actions = {
  onBack: () => undefined,
  onImpersonate: () => undefined,
  onMarkPaid: () => undefined,
  onExtendTrial: () => undefined,
  onChangePlan: () => undefined,
  onCloseBillingDialog: () => undefined,
  onSubmitChangePlan: () => undefined,
  onSubmitMarkPaid: () => undefined,
  onSubmitExtendTrial: () => undefined,
  onViewMember: () => undefined,
  onCloseMember: () => undefined,
  onBlockMember: () => undefined,
  onSetMemberAccount: () => undefined,
  onVoidPayment: () => undefined,
  onRefundPayment: () => undefined,
};

/** Story host: lever clicks open the dialog; cancel/submit close it. */
const LeverHost = () => {
  const [dialog, setDialog] = useState<BillingDialogVM | undefined>(undefined);
  const close = () => setDialog(undefined);
  return (
    <DashboardShell active="Directory">
      <OrgDetailView
        vm={{ ...populatedVM, billingDialog: dialog }}
        {...actions}
        onMarkPaid={() =>
          setDialog({ kind: 'mark-paid', preview: recordPaymentPreview })
        }
        onExtendTrial={() => setDialog({ kind: 'extend-trial' })}
        onChangePlan={() =>
          setDialog({ kind: 'change-plan', options: changePlanOptions })
        }
        onCloseBillingDialog={close}
        onSubmitChangePlan={close}
        onSubmitMarkPaid={close}
        onSubmitExtendTrial={close}
      />
    </DashboardShell>
  );
};

const inShell = (vm: OrgDetailVM) =>
  function Render() {
    return (
      <DashboardShell active="Directory">
        <OrgDetailView vm={vm} {...actions} />
      </DashboardShell>
    );
  };

/** Staff with `members.read` (any): full roster, owner marked, paid Pro plan. */
export const Populated: Story = { render: inShell(populatedVM) };
/** Also holds a `customer.read` grant → "View as customer" appears. */
export const WithImpersonation: Story = {
  render: inShell(withImpersonationVM),
};
/** A role without `members.read` — roster hidden; billing read-only (no levers). */
export const MembersHidden: Story = { render: inShell(gatedVM) };
/** Phase `grace`: trial ended, unpaid — service still on, counting down. */
export const Grace: Story = { render: inShell(trialExpiredVM) };
/** Phase `suspended`: grace elapsed — service off; Reactivate restores it. */
export const Suspended: Story = { render: inShell(suspendedVM) };
/** Suspended 3+ months, idle — flagged dormant for manual deletion review. */
export const Dormant: Story = { render: inShell(dormantVM) };
/** 5/3 seats after a downgrade — legal, flagged, growth-only enforcement. */
export const OverLimit: Story = { render: inShell(overLimitVM) };
export const Loading: Story = { render: inShell(loadingVM) };
export const LoadError: Story = { render: inShell(errorVM) };
/** Member detail panel: full info + ids, with the Unblock / Disable levers. */
export const MemberDetail: Story = { render: inShell(memberDetailVM) };
/** Billing ledger — a paid-up statement (balance $0.00); payment rows get the
 *  ⋯ void/refund corrections. */
export const Ledger: Story = {
  render: inShell({ ...populatedVM, ledger: demoLedger }),
};
/** Owing statement — an open Jul charge (balance $56.84) + a voided duplicate. */
export const LedgerOwing: Story = {
  render: inShell({ ...suspendedVM, ledger: demoLedgerOwing }),
};
/** Interactive: the levers open their dialogs; Cancel/submit close them. */
export const LeverFlows: Story = { render: () => <LeverHost /> };
