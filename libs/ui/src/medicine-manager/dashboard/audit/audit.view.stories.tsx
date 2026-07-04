import type { Meta, StoryObj } from '@storybook/react';
import { AuditView, type AuditRow } from './audit.view';
import { DashboardShell } from '../dashboard.shell';

const entries: readonly AuditRow[] = [
  {
    id: '1',
    type: 'session.revoked',
    actor: 'Ana Torres',
    occurredAt: '2026-07-01 18:04',
  },
  {
    id: '2',
    type: 'role.assigned',
    actor: 'Beto Ruiz',
    occurredAt: '2026-07-01 17:52',
  },
  // system-triggered event → no actor (renders "System")
  { id: '3', type: 'account.blocked', occurredAt: '2026-07-01 16:30' },
  {
    id: '4',
    type: 'invitation.sent',
    actor: 'ana@acme.com',
    occurredAt: '2026-07-01 15:10',
  },
];

const meta: Meta<typeof AuditView> = {
  title: 'Medicine Manager/Dashboard/Audit',
  component: AuditView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof AuditView>;

export const Populated: Story = {
  render: () => (
    <DashboardShell active="Audit">
      <AuditView vm={{ entries }} />
    </DashboardShell>
  ),
};
export const Empty: Story = {
  render: () => (
    <DashboardShell active="Audit">
      <AuditView vm={{ entries: [] }} />
    </DashboardShell>
  ),
};
