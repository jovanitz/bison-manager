import { z } from 'zod';
import { ok } from '@acme/shared';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { DirectoryUseCases } from '../../access-client/gateways/directory-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { BlockUseCases } from '../../access-client/gateways/block-use-cases';
import type { FlowCommand } from '../registry-types';
import { findFlowCommand } from '../registry-types';
import { loadDashboard, loadStaffMembers, resolveAdminGate } from './queries';
import {
  grantStaffPermission,
  inviteStaff,
  setSubjectBlocked,
} from './commands';

/** Everything a STAFF-side caller (the dashboard store or a staff MCP) wires once. */
export type DashboardFlowDeps = {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
  readonly members: MembersUseCases;
  readonly invitations: InvitationsUseCases;
  readonly block: BlockUseCases;
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
];

export const findDashboardFlow = (name: string) =>
  findFlowCommand(DASHBOARD_FLOWS, name);
