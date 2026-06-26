import { z } from 'zod';
import { ok } from '@acme/shared';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { OrgsUseCases } from '../../access-client/gateways/client/orgs-use-cases';
import type { RolesGateway } from '../../access-client/roles-ports';
import type { FlowCommand } from '../registry-types';
import { findFlowCommand } from '../registry-types';
import {
  grantMemberPermission,
  inviteToOrg,
  loadOrgAdmin,
  removeMember,
  setMemberBlocked,
} from './org-admin';
import {
  assignOrgMemberRoles,
  createOrgRole,
  deleteOrgRole,
  loadOrgRoles,
  resetOrgRole,
  updateOrgRole,
} from './roles';
import { createOrg, loadHome, switchOrg } from './home';
import { resolveClientGate } from './gate';

/**
 * The full set of headless dependencies a CLIENT-side caller (the UI store or a
 * customer-facing MCP server) wires once. A superset of each controller's own
 * deps, so any controller can be driven from it.
 */
export type ClientFlowDeps = {
  readonly access: AccessClientUseCases;
  readonly members: MembersUseCases;
  readonly invitations: InvitationsUseCases;
  readonly orgs: OrgsUseCases;
  readonly roles: RolesGateway;
};

const empty = z.object({});
const grantInput = z.object({
  accountId: z.string(),
  membershipId: z.string(),
  action: z.string(),
  scope: z.string().optional(),
});
const inviteInput = z.object({
  accountId: z.string(),
  email: z.string().email(),
  roleIds: z.array(z.string()).optional(),
});
const blockInput = z.object({ membershipId: z.string(), blocked: z.boolean() });
const membershipInput = z.object({ membershipId: z.string() });
const createOrgInput = z.object({ name: z.string().min(1) });
const roleIdInput = z.object({ roleId: z.string() });
const createRoleInput = z.object({
  name: z.string().min(1),
  permissions: z.array(z.object({ action: z.string(), scope: z.string() })),
});
const updateRoleInput = z.object({
  roleId: z.string(),
  name: z.string().min(1),
  permissions: z.array(z.object({ action: z.string(), scope: z.string() })),
});
const assignRolesInput = z.object({
  membershipId: z.string(),
  roleIds: z.array(z.string()),
});

/** The enumerable catalog of client flows — one MCP tool per entry. */
export const CLIENT_FLOWS: ReadonlyArray<FlowCommand<ClientFlowDeps>> = [
  {
    name: 'org.load',
    kind: 'query',
    description: 'Load the org-admin view (members + capability flags).',
    input: empty,
    run: (deps) => loadOrgAdmin(deps),
  },
  {
    name: 'org.members.grant',
    kind: 'command',
    description: 'Grant a delegable own-scope permission to a member.',
    input: grantInput,
    run: (deps, input) => grantMemberPermission(deps, grantInput.parse(input)),
  },
  {
    name: 'org.members.invite',
    kind: 'command',
    description: 'Invite an email into the org with the default member grant.',
    input: inviteInput,
    run: (deps, input) => inviteToOrg(deps, inviteInput.parse(input)),
  },
  {
    name: 'org.members.setBlocked',
    kind: 'command',
    description: 'Soft-block or unblock a member of your org.',
    input: blockInput,
    run: (deps, input) => setMemberBlocked(deps, blockInput.parse(input)),
  },
  {
    name: 'org.members.remove',
    kind: 'command',
    description: 'Remove a member from your org.',
    input: membershipInput,
    run: (deps, input) => removeMember(deps, membershipInput.parse(input)),
  },
  {
    name: 'home.load',
    kind: 'query',
    description: "Load the caller's access snapshot + their organizations.",
    input: empty,
    run: (deps) => loadHome(deps),
  },
  {
    name: 'home.switch',
    kind: 'command',
    description: 'Re-bind the live session to another of your memberships.',
    input: membershipInput,
    run: (deps, input) => switchOrg(deps, membershipInput.parse(input)),
  },
  {
    name: 'home.createOrg',
    kind: 'command',
    description: 'Create a new organization (you become its admin).',
    input: createOrgInput,
    run: (deps, input) => createOrg(deps, createOrgInput.parse(input)),
  },
  {
    name: 'org.roles.load',
    kind: 'query',
    description: "Load your org's roles (gated on permissions.update).",
    input: empty,
    run: (deps) => loadOrgRoles(deps),
  },
  {
    name: 'org.roles.create',
    kind: 'command',
    description: 'Create a role in your own org (customer-delegable actions).',
    input: createRoleInput,
    run: (deps, input) => createOrgRole(deps, createRoleInput.parse(input)),
  },
  {
    name: 'org.roles.delete',
    kind: 'command',
    description: 'Delete a custom org role (refused for defaults / in-use).',
    input: roleIdInput,
    run: (deps, input) => deleteOrgRole(deps, roleIdInput.parse(input)),
  },
  {
    name: 'org.roles.reset',
    kind: 'command',
    description: 'Reset a default org role to its template (the recovery net).',
    input: roleIdInput,
    run: (deps, input) => resetOrgRole(deps, roleIdInput.parse(input)),
  },
  {
    name: 'org.roles.update',
    kind: 'command',
    description: "Edit an org role's name + permissions in place (live).",
    input: updateRoleInput,
    run: (deps, input) => updateOrgRole(deps, updateRoleInput.parse(input)),
  },
  {
    name: 'org.members.assignRoles',
    kind: 'command',
    description: "Replace a member's whole role assignment (roles-only).",
    input: assignRolesInput,
    run: (deps, input) =>
      assignOrgMemberRoles(deps, assignRolesInput.parse(input)),
  },
  {
    name: 'gate.resolve',
    kind: 'query',
    description:
      'Resolve the session gate: anonymous | no-org | blocked | authenticated.',
    input: empty,
    run: async (deps) => ok(await resolveClientGate(deps)),
  },
];

export const findClientFlow = (name: string) =>
  findFlowCommand(CLIENT_FLOWS, name);
