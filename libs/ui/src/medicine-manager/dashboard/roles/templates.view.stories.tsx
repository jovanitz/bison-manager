import type { Meta, StoryObj } from '@storybook/react';
import {
  TemplatesView,
  type TemplateRow,
  type TemplatesVM,
} from './templates.view';
import { DashboardShell } from '../dashboard.shell';

const templates: readonly TemplateRow[] = [
  { key: 'owner', name: 'Owner', scope: 'own', permissions: ['*:own'] },
  {
    key: 'admin',
    name: 'Admin',
    scope: 'own',
    permissions: ['members.read:own', 'members.invite:own', 'roles.manage:own'],
  },
  {
    key: 'member',
    name: 'Member',
    scope: 'own',
    permissions: ['home.read:own'],
  },
];

const meta: Meta<typeof TemplatesView> = {
  title: 'Medicine Manager/Dashboard/Templates',
  component: TemplatesView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof TemplatesView>;

const actions = {
  onRename: () => undefined,
  onReset: () => undefined,
  onApplyToAll: () => undefined,
};

const inShell = (vm: TemplatesVM) =>
  function Render() {
    return (
      <DashboardShell active="Templates">
        <TemplatesView vm={vm} {...actions} />
      </DashboardShell>
    );
  };

export const CanManage: Story = {
  render: inShell({ templates, canManage: true }),
};
export const ReadOnly: Story = {
  render: inShell({ templates, canManage: false }),
};
