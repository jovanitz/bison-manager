import { type Result, err } from '@acme/shared';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { BlockUseCases } from '../../access-client/gateways/block-use-cases';
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
