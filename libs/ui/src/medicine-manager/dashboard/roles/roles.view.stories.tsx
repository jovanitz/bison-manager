import type { Meta, StoryObj } from '@storybook/react';
import { RolesView, type RoleRow, type RolesVM } from './roles.view';
import { DashboardShell } from '../dashboard.shell';

const roles: readonly RoleRow[] = [
  {
    id: 'r1',
    name: 'Owner',
    scopeLabel: 'platform',
    permissions: ['*:any'],
    isDefault: true,
    synced: true,
  },
  {
    id: 'r2',
    name: 'Support',
    scopeLabel: 'org_11',
    permissions: ['staff.read:any', 'account.read:own'],
    isDefault: false,
    synced: false,
  },
  {
    id: 'r3',
    name: 'Auditor',
    scopeLabel: 'org_11',
    permissions: ['audit.read:any'],
    isDefault: true,
    synced: false,
  },
];

const meta: Meta<typeof RolesView> = {
  title: 'Medicine Manager/Dashboard/Roles',
  component: RolesView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof RolesView>;

const actions = {
  onCreate: () => undefined,
  onReset: () => undefined,
  onDelete: () => undefined,
};

const inShell = (vm: RolesVM) =>
  function Render() {
    return (
      <DashboardShell active="Roles">
        <RolesView vm={vm} {...actions} />
      </DashboardShell>
    );
  };

export const CanManage: Story = { render: inShell({ roles, canManage: true }) };
export const ReadOnly: Story = { render: inShell({ roles, canManage: false }) };
