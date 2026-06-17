import { z } from 'zod';
import { ok } from '@acme/shared';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { OrgsUseCases } from '../../access-client/gateways/client/orgs-use-cases';
import type { FlowCommand } from '../registry-types';
import { findFlowCommand } from '../registry-types';
import {
  grantMemberPermission,
  inviteToOrg,
  loadOrgAdmin,
  removeMember,
  setMemberBlocked,
} from './org-admin';
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
});
const blockInput = z.object({ membershipId: z.string(), blocked: z.boolean() });
const membershipInput = z.object({ membershipId: z.string() });
const createOrgInput = z.object({ name: z.string().min(1) });

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
