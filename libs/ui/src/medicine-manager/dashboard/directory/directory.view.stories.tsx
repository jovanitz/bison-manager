import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DirectoryView, type DirectoryVM } from './directory.view';
import { DashboardShell } from '../dashboard.shell';
import { OrgDetailView } from '../org-detail/org-detail.view';
import { populatedVM as orgDetailVM } from '../org-detail/org-detail.fixtures';
import {
  errorVM,
  limitedVM,
  loadingVM,
  populatedVM,
} from './directory.fixtures';

const meta: Meta<typeof DirectoryView> = {
  title: 'Medicine Manager/Dashboard/Directory',
  component: DirectoryView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen', docs: { story: { height: '640px' } } },
};
export default meta;

type Story = StoryObj<typeof DirectoryView>;

const inShell = (vm: DirectoryVM) =>
  function Render() {
    return (
      <DashboardShell active="Directory">
        <DirectoryView
          vm={vm}
          onBlock={() => undefined}
          onAdmin={() => undefined}
          onRegenerate={() => undefined}
          onOpenOrg={() => undefined}
        />
      </DashboardShell>
    );
  };

export const Populated: Story = { render: inShell(populatedVM) };
export const LimitedPermissions: Story = { render: inShell(limitedVM) };
export const Loading: Story = { render: inShell(loadingVM) };
export const LoadError: Story = { render: inShell(errorVM) };

/**
 * The drill-down flow: click an organization's name in the Organizations tab to
 * open its detail (owner + member roster), then back. Navigation state lives in
 * the story — the views stay pure functions of (ViewModel + actions).
 */
export const OrgDrilldown: Story = {
  render: function Render() {
    const [orgId, setOrgId] = useState<string | null>(null);
    const clicked = populatedVM.customers.find((c) => c.accountId === orgId);
    return (
      <DashboardShell active="Directory">
        {orgId ? (
          <OrgDetailView
            vm={{
              ...orgDetailVM,
              accountId: orgId,
              name: clicked?.displayName ?? orgDetailVM.name,
            }}
            onBack={() => setOrgId(null)}
            onImpersonate={() => undefined}
            onMarkPaid={() => undefined}
            onExtendTrial={() => undefined}
            onChangePlan={() => undefined}
            onCloseBillingDialog={() => undefined}
            onSubmitChangePlan={() => undefined}
            onSubmitMarkPaid={() => undefined}
            onSubmitExtendTrial={() => undefined}
            onViewMember={() => undefined}
            onCloseMember={() => undefined}
            onBlockMember={() => undefined}
            onSetMemberAccount={() => undefined}
            onMarkPaymentPaid={() => undefined}
          />
        ) : (
          <DirectoryView
            vm={populatedVM}
            onBlock={() => undefined}
            onAdmin={() => undefined}
            onRegenerate={() => undefined}
            onOpenOrg={setOrgId}
          />
        )}
      </DashboardShell>
    );
  },
};
