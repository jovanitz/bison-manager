import type { Meta, StoryObj } from '@storybook/react';
import { StaffDetailView, type StaffDetailVM } from './permissions.view';
import type { MemberRow, SessionRow } from './permissions.types';
import { DashboardShell } from '../dashboard.shell';

const member: MemberRow = {
  membershipId: 'm1',
  userId: 'u1',
  displayName: 'Ana Torres',
  email: 'ana@acme.com',
  permissions: ['staff.read:any', 'roles.manage:own'],
  roleIds: ['r1'],
  blocked: false,
};

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
  onRevokeSession: () => undefined,
  onRevokeAll: () => undefined,
};

const vm: StaffDetailVM = {
  member,
  availableRoles,
  sessions,
  canEdit: true,
  canBlock: true,
  canReadSessions: true,
};

const meta: Meta<typeof StaffDetailView> = {
  title: 'Medicine Manager/Dashboard/Staff Detail',
  component: StaffDetailView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof StaffDetailView>;

/** A staff member's access — grants, role toggles, block switch and sessions. */
export const Default: Story = {
  render: () => (
    <DashboardShell active="Directory">
      <StaffDetailView vm={vm} onBack={() => undefined} {...actions} />
    </DashboardShell>
  ),
};

/** A role without edit/block/session rights — read-only access view. */
export const ReadOnly: Story = {
  render: () => (
    <DashboardShell active="Directory">
      <StaffDetailView
        vm={{
          ...vm,
          canEdit: false,
          canBlock: false,
          canReadSessions: false,
          sessions: [],
        }}
        onBack={() => undefined}
        {...actions}
      />
    </DashboardShell>
  ),
};
