import type { Meta, StoryObj } from '@storybook/react';
import { AuditView, type AuditRow } from './audit.view';
import { DashboardShell } from '../dashboard.shell';

const entries: readonly AuditRow[] = [
  {
    id: '1',
    type: 'org.deletion_scheduled',
    category: 'access',
    actor: 'Ana Torres',
    target: { label: 'Óptica Vista', kind: 'org', id: 'org_16' },
    occurredAt: '2026-07-13 18:04',
  },
  {
    id: '2',
    type: 'payment.voided',
    category: 'billing',
    actor: 'Ana Torres',
    target: { label: 'Salud Total', kind: 'org', id: 'org_15' },
    occurredAt: '2026-07-13 12:20',
  },
  {
    id: '3',
    type: 'staff.demoted',
    category: 'access',
    actor: 'Ana Torres',
    target: { label: 'Cami Díaz', kind: 'staff', id: 'acc_03' },
    occurredAt: '2026-07-12 09:41',
  },
  // system-triggered event → no actor (renders "System")
  {
    id: '4',
    type: 'org.blocked',
    category: 'access',
    target: { label: 'Hospital Río', kind: 'org', id: 'org_13' },
    occurredAt: '2026-07-11 16:30',
  },
  {
    id: '5',
    type: 'payment.recorded',
    category: 'billing',
    actor: 'Beto Ruiz',
    target: { label: 'Clínica Norte', kind: 'org', id: 'org_11' },
    occurredAt: '2026-07-10 11:05',
  },
  {
    id: '6',
    type: 'invite.sent',
    category: 'invites',
    actor: 'ana@acme.com',
    target: { label: 'nuevo@norte.mx', kind: 'identity' },
    occurredAt: '2026-07-09 15:10',
  },
  {
    id: '7',
    type: 'role.assigned',
    category: 'roles',
    actor: 'Ana Torres',
    target: { label: 'Beto Ruiz', kind: 'staff', id: 'acc_02' },
    occurredAt: '2026-07-08 17:52',
  },
  {
    id: '8',
    type: 'session.revoked',
    category: 'sessions',
    actor: 'Ana Torres',
    target: { label: 'Ana Torres', kind: 'staff', id: 'acc_01' },
    occurredAt: '2026-07-08 08:12',
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
      <AuditView vm={{ entries }} onOpenTarget={() => undefined} />
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
