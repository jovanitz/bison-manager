import { type Result, err } from '@acme/shared';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { BlockUseCases } from '../../access-client/gateways/block-use-cases';
import type {
  AccountAdminGateway,
  AdminSessionDto,
  SessionPoliciesDto,
  SessionsGateway,
  SettingsGateway,
} from '../../access-client/admin-ports';
import type { DashboardError } from './queries';

/** The fixed grant a freshly invited STAFF member lands with (dashboard view). */
export const STAFF_DASHBOARD_GRANT: ReadonlyArray<{
  readonly action: string;
  readonly scope: string;
}> = [
  { action: 'staff.read', scope: 'any' },
  { action: 'customer.search', scope: 'any' },
];

/**
 * Command: grant a permission to a member. Staff may use any scope; reads the
 * member's current set, appends, and replaces it (the gateway takes the full set).
 */
export const grantStaffPermission = async (
  deps: { readonly members: MembersUseCases },
  input: {
    readonly accountId: string;
    readonly membershipId: string;
    readonly action: string;
    readonly scope: string;
  },
): Promise<Result<void, DashboardError>> => {
  const listed = await deps.members.listMembers(input.accountId);
  if (!listed.ok) return err(listed.error);
  const member = listed.value.find(
    (m) => m.membershipId === input.membershipId,
  );
  if (!member) {
    return err({
      tag: 'app/access-gateway-error',
      message: `No member ${input.membershipId} in account ${input.accountId}.`,
    });
  }
  return deps.members.updatePermissions({
    membershipId: input.membershipId,
    permissions: [
      ...member.permissions,
      { action: input.action, scope: input.scope },
    ],
  });
};

/** Command: invite a staff member into an account with the fixed staff grant. */
export const inviteStaff = (
  deps: { readonly invitations: InvitationsUseCases },
  input: { readonly accountId: string; readonly email: string },
) =>
  deps.invitations.invite({
    accountId: input.accountId,
    email: input.email,
    permissions: STAFF_DASHBOARD_GRANT,
  });

/**
 * Command: invite into the CALLER's own account. Resolves the actor's accountId
 * from the access snapshot first (the dashboard invites into its own account),
 * then delegates to `inviteStaff` — orchestration the component used to do.
 */
export const inviteStaffToOwnAccount = async (
  deps: {
    readonly access: AccessClientUseCases;
    readonly invitations: InvitationsUseCases;
  },
  input: { readonly email: string },
): Promise<Result<{ readonly token: string }, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const result = await inviteStaff(deps, {
    accountId: snapshot.value.accountId,
    email: input.email,
  });
  if (!result.ok) return err(result.error);
  return { ok: true, value: { token: result.value.token } };
};

/** Command: soft-block / unblock a subject (an org account or a user identity). */
export const setSubjectBlocked = (
  deps: { readonly block: BlockUseCases },
  input: {
    readonly subject: 'org' | 'identity';
    readonly id: string;
    readonly blocked: boolean;
  },
): Promise<Result<void, DashboardError>> => {
  if (input.subject === 'org') {
    return input.blocked
      ? deps.block.blockOrg(input.id)
      : deps.block.unblockOrg(input.id);
  }
  return input.blocked
    ? deps.block.blockIdentity(input.id)
    : deps.block.unblockIdentity(input.id);
};

/**
 * Command: an account lifecycle action (ADR-0010). `disable` hard-suspends (all
 * sessions denied next request), `enable` undoes it, `promote` moves a customer
 * to staff (one-way, out of the impersonable directory). The server re-checks
 * the owner-level permission for each.
 */
export const adminAccount = (
  deps: { readonly accounts: AccountAdminGateway },
  input: {
    readonly action:
      | 'disable'
      | 'enable'
      | 'promote'
      | 'demote'
      | 'scheduleDeletion'
      | 'cancelDeletion';
    readonly accountId: string;
    readonly reason?: string | undefined;
  },
): Promise<Result<void, DashboardError>> => {
  if (input.action === 'disable')
    return deps.accounts.disable(input.accountId, input.reason);
  if (input.action === 'enable') return deps.accounts.enable(input.accountId);
  if (input.action === 'demote') return deps.accounts.demote(input.accountId);
  if (input.action === 'scheduleDeletion')
    return deps.accounts.scheduleDeletion(input.accountId);
  if (input.action === 'cancelDeletion')
    return deps.accounts.cancelDeletion(input.accountId);
  return deps.accounts.promote(input.accountId);
};

/** Query: a membership's active sessions (ADR-0010, the "active sessions" view). */
export const loadMemberSessions = (
  deps: { readonly sessions: SessionsGateway },
  input: { readonly membershipId: string },
): Promise<Result<ReadonlyArray<AdminSessionDto>, DashboardError>> =>
  deps.sessions.list(input.membershipId);

/** Command: revoke one session — it stops authorizing immediately. */
export const revokeMemberSession = (
  deps: { readonly sessions: SessionsGateway },
  input: { readonly sessionId: string },
): Promise<Result<void, DashboardError>> =>
  deps.sessions.revoke(input.sessionId);

/** Command: log a membership out everywhere (revoke all its sessions). */
export const revokeAllMemberSessions = (
  deps: { readonly sessions: SessionsGateway },
  input: { readonly membershipId: string },
): Promise<Result<void, DashboardError>> =>
  deps.sessions.revokeAll(input.membershipId);

/** Command: reconfigure the runtime session policy (owner `settings.update`). */
export const updateSessionPolicy = (
  deps: { readonly settings: SettingsGateway },
  input: { readonly policies: SessionPoliciesDto },
): Promise<Result<void, DashboardError>> =>
  deps.settings.update(input.policies);
