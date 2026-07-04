import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { DirectoryUseCases } from '../../access-client/gateways/directory-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { BlockUseCases } from '../../access-client/gateways/block-use-cases';
import type {
  AccountAdminGateway,
  AuditGateway,
  SessionsGateway,
  SettingsGateway,
} from '../../access-client/admin-ports';
import type { RolesGateway } from '../../access-client/roles-ports';
import type { OrgDetailGateway } from '../../access-client/ports';
import type { FlowCommand } from '../registry-types';
import { loadAuditTrail, loadSessionPolicy } from './queries';
import {
  adminAccount,
  loadMemberSessions,
  revokeAllMemberSessions,
  revokeMemberSession,
  updateSessionPolicy,
} from './commands';
import {
  adminAccountInput,
  empty,
  membershipInput,
  sessionIdInput,
  sessionPolicyInput,
} from './registry-inputs';

/** Everything a STAFF-side caller (the dashboard store or a staff MCP) wires once. */
export type DashboardFlowDeps = {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
  readonly members: MembersUseCases;
  readonly invitations: InvitationsUseCases;
  readonly block: BlockUseCases;
  readonly roles: RolesGateway;
  readonly orgs: OrgDetailGateway;
  readonly accounts: AccountAdminGateway;
  readonly audit: AuditGateway;
  readonly sessions: SessionsGateway;
  readonly settings: SettingsGateway;
};

/**
 * The account-administration slice of the dashboard flow catalog (ADR-0010):
 * account lifecycle, the audit trail, and active-session management. Split out
 * of `registry.ts` so that file stays within the file-length budget while every
 * flow stays MCP-enumerable.
 */
export const ADMIN_FLOWS: ReadonlyArray<FlowCommand<DashboardFlowDeps>> = [
  {
    name: 'account.admin',
    kind: 'command',
    description:
      'Account lifecycle: disable (hard suspend), enable, or promote to staff.',
    input: adminAccountInput,
    run: (deps, input) => adminAccount(deps, adminAccountInput.parse(input)),
  },
  {
    name: 'audit.load',
    kind: 'query',
    description: 'Load the recent security audit trail (gated on audit.read).',
    input: empty,
    run: (deps) => loadAuditTrail(deps),
  },
  {
    name: 'sessions.load',
    kind: 'query',
    description:
      "Load a membership's active sessions (gated on sessions.read).",
    input: membershipInput,
    run: (deps, input) =>
      loadMemberSessions(deps, membershipInput.parse(input)),
  },
  {
    name: 'sessions.revoke',
    kind: 'command',
    description: 'Revoke one session; it stops authorizing immediately.',
    input: sessionIdInput,
    run: (deps, input) =>
      revokeMemberSession(deps, sessionIdInput.parse(input)),
  },
  {
    name: 'sessions.revokeAll',
    kind: 'command',
    description: 'Log a membership out everywhere (revoke all its sessions).',
    input: membershipInput,
    run: (deps, input) =>
      revokeAllMemberSessions(deps, membershipInput.parse(input)),
  },
  {
    name: 'settings.load',
    kind: 'query',
    description:
      'Load the runtime session policy + version (gated on settings.update).',
    input: empty,
    run: (deps) => loadSessionPolicy(deps),
  },
  {
    name: 'settings.save',
    kind: 'command',
    description:
      'Reconfigure the session lifetime policy; tightening shrinks live ones.',
    input: sessionPolicyInput,
    run: (deps, input) =>
      updateSessionPolicy(deps, sessionPolicyInput.parse(input)),
  },
];
