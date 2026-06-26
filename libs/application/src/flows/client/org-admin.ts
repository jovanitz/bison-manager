import { type Result, type TaggedError, err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type { MemberSummaryDto } from '../../access-client/ports';
import type {
  RolesGateway,
  RoleSummaryDto,
} from '../../access-client/roles-ports';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import { holdsAction } from '../capabilities';

/**
 * The org-admin controller: HEADLESS orchestration for the client app's "manage
 * your organization" feature. It composes the existing client use-case bundles
 * (access snapshot + member admin + invitations), builds a ViewModel the UI
 * renders verbatim, and exposes commands as plain async functions returning
 * `Result`. No React, no browser, no transport — a React store and a future MCP
 * server drive the SAME functions. Deps are passed explicitly (DI by parameter).
 */
export type OrgAdminDeps = {
  readonly access: AccessClientUseCases;
  readonly members: MembersUseCases;
  readonly invitations: InvitationsUseCases;
  readonly roles: RolesGateway;
};

/** The default own-scope grant a freshly invited member lands with. */
export const DEFAULT_MEMBER_GRANT: ReadonlyArray<{
  readonly action: string;
  readonly scope: string;
}> = [{ action: 'customer.read', scope: 'own' }];

/** What the UI renders. `hidden` collapses the whole section. */
export type OrgAdminViewModel =
  | { readonly hidden: true }
  | {
      readonly hidden: false;
      readonly accountId: string;
      readonly access: CurrentAccessDto;
      readonly members: ReadonlyArray<MemberSummaryDto>;
      /** The org's roles, for the per-member assignment control (ADR-0011). */
      readonly availableRoles: ReadonlyArray<RoleSummaryDto>;
      readonly canInvite: boolean;
      readonly canEdit: boolean;
      readonly canRemove: boolean;
      readonly canBlock: boolean;
    };

export type OrgAdminError = TaggedError<
  'app/access-denied' | 'app/access-gateway-error'
>;

/**
 * Query: load the org-admin ViewModel. Composes `currentAccess` + `listMembers`
 * and derives the capability flags — exactly what `useOrgAdmin` did, minus React.
 */
export const loadOrgAdmin = async (
  deps: OrgAdminDeps,
): Promise<Result<OrgAdminViewModel, OrgAdminError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const access = snapshot.value;
  if (!holdsAction(access, 'members.read')) return ok({ hidden: true });
  const listed = await deps.members.listMembers(access.accountId);
  if (!listed.ok) return err(listed.error);
  // Roles power the assignment control — only an editor needs (and can see) them.
  const canEdit = holdsAction(access, 'permissions.update');
  const roles = canEdit
    ? await deps.roles.listRoles(access.accountId)
    : ok<ReadonlyArray<RoleSummaryDto>>([]);
  if (!roles.ok) return err(roles.error);
  return ok({
    hidden: false,
    accountId: access.accountId,
    access,
    members: listed.value,
    availableRoles: roles.value,
    canInvite: holdsAction(access, 'members.invite'),
    canEdit,
    canRemove: holdsAction(access, 'members.remove'),
    canBlock: holdsAction(access, 'members.block'),
  });
};

/**
 * Command: grant a delegable (own-scope) permission to a member. Reads the
 * member's CURRENT permissions from a fresh roster, appends the grant, and
 * replaces the set (the gateway takes the full set, not a delta).
 */
export const grantMemberPermission = async (
  deps: OrgAdminDeps,
  input: {
    readonly accountId: string;
    readonly membershipId: string;
    readonly action: string;
    readonly scope?: string | undefined;
  },
): Promise<Result<void, OrgAdminError>> => {
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
      { action: input.action, scope: input.scope ?? 'own' },
    ],
  });
};

/**
 * Command: invite an email into the org with the default member grant, plus any
 * chosen roles (ADR-0011) — applied to the membership on the invitee's first
 * login. The default grant is a baseline; the roles carry the real authority.
 */
export const inviteToOrg = async (
  deps: OrgAdminDeps,
  input: {
    readonly accountId: string;
    readonly email: string;
    readonly roleIds?: ReadonlyArray<string> | undefined;
  },
): Promise<Result<{ readonly token: string }, OrgAdminError>> => {
  const result = await deps.invitations.invite({
    accountId: input.accountId,
    email: input.email,
    permissions: DEFAULT_MEMBER_GRANT,
    ...(input.roleIds && input.roleIds.length > 0
      ? { roleIds: input.roleIds }
      : {}),
  });
  if (!result.ok) return err(result.error);
  return ok({ token: result.value.token });
};

/** Command: soft-block / unblock a member of your org. */
export const setMemberBlocked = (
  deps: OrgAdminDeps,
  input: { readonly membershipId: string; readonly blocked: boolean },
): Promise<Result<void, OrgAdminError>> => deps.members.setMemberBlocked(input);

/** Command: remove a member from the org. */
export const removeMember = (
  deps: OrgAdminDeps,
  input: { readonly membershipId: string },
): Promise<Result<void, OrgAdminError>> => deps.members.removeMember(input);
