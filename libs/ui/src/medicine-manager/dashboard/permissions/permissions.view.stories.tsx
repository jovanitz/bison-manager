import type { Meta, StoryObj } from '@storybook/react';
import { PermissionsView } from './permissions.view';
import type { MemberRow, PermissionsVM, SessionRow } from './permissions.types';
import { DashboardShell } from '../dashboard.shell';

const members: readonly MemberRow[] = [
  {
    membershipId: 'm1',
    userId: 'u1',
    displayName: 'Ana Torres',
    email: 'ana@acme.com',
    permissions: ['staff.read:any', 'roles.manage:own'],
    roleIds: ['r1'],
    blocked: false,
  },
  {
    membershipId: 'm2',
    userId: 'u2',
    displayName: 'Beto Ruiz',
    email: 'beto@acme.com',
    permissions: ['home.read:own'],
    roleIds: [],
    blocked: true,
  },
];

const availableRoles = [
  { id: 'r1', name: 'Owner' },
  { id: 'r2', name: 'Support' },
  { id: 'r3', name: 'Auditor' },
];

const sessions: readonly SessionRow[] = [
  { id: 'sess_abc123', createdAt: '2026-07-01 18:00' },
  { id: 'sess_def456', createdAt: '2026-06-28 09:12' },
];

const actions = {
  onGrant: () => undefined,
  onAssignRoles: () => undefined,
  onBlockIdentity: () => undefined,
  onLoadSessions: () => undefined,
  onRevokeSession: () => undefined,
  onRevokeAll: () => undefined,
};

const vm: PermissionsVM = {
  members,
  availableRoles,
  canEdit: true,
  canBlock: true,
  canReadSessions: true,
};

const meta: Meta<typeof PermissionsView> = {
  title: 'Medicine Manager/Dashboard/Permissions',
  component: PermissionsView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof PermissionsView>;

/** Pick a member to reveal grants, role toggles, block switch and sessions. */
export const Default: Story = {
  render: () => (
    <DashboardShell active="Permissions">
      <PermissionsView vm={vm} sessions={sessions} {...actions} />
    </DashboardShell>
  ),
};

export const ReadOnly: Story = {
  render: () => (
    <DashboardShell active="Permissions">
      <PermissionsView
        vm={{ ...vm, canEdit: false, canBlock: false, canReadSessions: false }}
        sessions={[]}
        {...actions}
      />
    </DashboardShell>
  ),
};
