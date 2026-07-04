/** Shared types for the Permissions section — kept import-free so the view and
 *  its parts (member-detail, sessions) can all depend on it without a cycle. */

export type MemberRow = {
  readonly membershipId: string;
  readonly userId: string;
  readonly displayName?: string;
  readonly email?: string;
  readonly permissions: readonly string[];
  readonly roleIds: readonly string[];
  readonly blocked: boolean;
};

export type RoleOption = { readonly id: string; readonly name: string };
export type SessionRow = { readonly id: string; readonly createdAt: string };

export type PermissionsVM = {
  readonly members: readonly MemberRow[];
  readonly availableRoles: readonly RoleOption[];
  readonly canEdit: boolean;
  readonly canBlock: boolean;
  readonly canReadSessions: boolean;
  readonly notice?: string;
};

export type PermissionsActions = {
  readonly onGrant: (
    membershipId: string,
    action: string,
    scope: string,
  ) => void;
  readonly onAssignRoles: (membershipId: string, roleIds: string[]) => void;
  readonly onBlockIdentity: (userId: string, blocked: boolean) => void;
  readonly onLoadSessions: (membershipId: string) => void;
  readonly onRevokeSession: (sessionId: string, membershipId: string) => void;
  readonly onRevokeAll: (membershipId: string) => void;
};
