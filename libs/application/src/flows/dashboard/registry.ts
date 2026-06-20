import { z } from 'zod';
import { ok } from '@acme/shared';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { DirectoryUseCases } from '../../access-client/gateways/directory-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { BlockUseCases } from '../../access-client/gateways/block-use-cases';
import type { RolesGateway } from '../../access-client/ports';
import type { FlowCommand } from '../registry-types';
import { findFlowCommand } from '../registry-types';
import { loadDashboard, loadStaffMembers, resolveAdminGate } from './queries';
import {
  grantStaffPermission,
  inviteStaff,
  setSubjectBlocked,
} from './commands';
import {
  assignMemberRoles,
  createPlatformRole,
  deletePlatformRole,
  loadPlatformRoles,
  resetPlatformRole,
} from './roles';

/** Everything a STAFF-side caller (the dashboard store or a staff MCP) wires once. */
export type DashboardFlowDeps = {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
  readonly members: MembersUseCases;
  readonly invitations: InvitationsUseCases;
  readonly block: BlockUseCases;
  readonly roles: RolesGateway;
};

const empty = z.object({});
const grantInput = z.object({
  accountId: z.string(),
  membershipId: z.string(),
  action: z.string(),
  scope: z.string(),
});
const inviteInput = z.object({
  accountId: z.string(),
  email: z.string().email(),
});
const blockInput = z.object({
  subject: z.enum(['org', 'identity']),
  id: z.string(),
  blocked: z.boolean(),
});
const permissionsInput = z.array(
  z.object({ action: z.string(), scope: z.string() }),
);
const createRoleInput = z.object({
  name: z.string(),
  permissions: permissionsInput,
});
const deleteRoleInput = z.object({ roleId: z.string() });
const assignRolesInput = z.object({
  membershipId: z.string(),
  roleIds: z.array(z.string()),
});

export const DASHBOARD_FLOWS: ReadonlyArray<FlowCommand<DashboardFlowDeps>> = [
  {
    name: 'admin.gate',
    kind: 'query',
    description:
      'Resolve the admin gate: anonymous | forbidden | blocked | authorized.',
    input: empty,
    run: async (deps) => ok(await resolveAdminGate(deps)),
  },
  {
    name: 'dashboard.load',
    kind: 'query',
    description: 'Load the staff + customers tables and the block capability.',
    input: empty,
    run: (deps) => loadDashboard(deps),
  },
  {
    name: 'staff.members.load',
    kind: 'query',
    description: "Load the actor's account members for the permissions editor.",
    input: empty,
    run: (deps) => loadStaffMembers(deps),
  },
  {
    name: 'staff.members.grant',
    kind: 'command',
    description: 'Grant a permission (any scope) to a member.',
    input: grantInput,
    run: (deps, input) => grantStaffPermission(deps, grantInput.parse(input)),
  },
  {
    name: 'staff.invite',
    kind: 'command',
    description:
      'Invite a staff member into an account with the fixed staff grant.',
    input: inviteInput,
    run: (deps, input) => inviteStaff(deps, inviteInput.parse(input)),
  },
  {
    name: 'access.setBlocked',
    kind: 'command',
    description: 'Soft-block or unblock an org account or a user identity.',
    input: blockInput,
    run: (deps, input) => setSubjectBlocked(deps, blockInput.parse(input)),
  },
  {
    name: 'roles.load',
    kind: 'query',
    description: 'Load the platform roles + whether the actor may manage them.',
    input: empty,
    run: (deps) => loadPlatformRoles(deps),
  },
  {
    name: 'roles.create',
    kind: 'command',
    description: 'Create a platform-wide role (a named permission bundle).',
    input: createRoleInput,
    run: (deps, input) =>
      createPlatformRole(deps, createRoleInput.parse(input)),
  },
  {
    name: 'roles.delete',
    kind: 'command',
    description:
      'Delete a role; the server refuses while it is still assigned.',
    input: deleteRoleInput,
    run: (deps, input) =>
      deletePlatformRole(deps, deleteRoleInput.parse(input)),
  },
  {
    name: 'roles.assign',
    kind: 'command',
    description: "Replace a membership's whole role assignment (roles-only).",
    input: assignRolesInput,
    run: (deps, input) =>
      assignMemberRoles(deps, assignRolesInput.parse(input)),
  },
  {
    name: 'roles.reset',
    kind: 'command',
    description: 'Reset a default role to its factory template (ADR-0012).',
    input: deleteRoleInput,
    run: (deps, input) => resetPlatformRole(deps, deleteRoleInput.parse(input)),
  },
];

export const findDashboardFlow = (name: string) =>
  findFlowCommand(DASHBOARD_FLOWS, name);
