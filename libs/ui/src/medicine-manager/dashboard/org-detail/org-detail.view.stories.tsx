import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OrgDetailView } from './org-detail.view';
import type { BillingDialogVM, OrgDetailVM } from './org-detail.types';
import {
  populatedVM,
  withImpersonationVM,
  gatedVM,
  trialExpiredVM,
  overLimitVM,
  loadingVM,
  errorVM,
  changePlanOptions,
} from './org-detail.fixtures';
import { DashboardShell } from '../dashboard.shell';

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
        onMarkPaid={() => setDialog({ kind: 'mark-paid' })}
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
/** Phase `past_due`: trial over, never paid — the warning banner shows. */
export const TrialExpired: Story = { render: inShell(trialExpiredVM) };
/** 5/3 seats after a downgrade — legal, flagged, growth-only enforcement. */
export const OverLimit: Story = { render: inShell(overLimitVM) };
export const Loading: Story = { render: inShell(loadingVM) };
export const LoadError: Story = { render: inShell(errorVM) };
/** Interactive: the levers open their dialogs; Cancel/submit close them. */
export const LeverFlows: Story = { render: () => <LeverHost /> };
