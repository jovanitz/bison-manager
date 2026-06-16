import type { Result, TaggedError } from '@acme/shared';
import type { CurrentAccessDto } from '../access/dto';
import type { StaffAccountSummary } from '../access-directory/ports';
import type { CustomerAccountSummary } from '../impersonation/ports';

/** The two failure modes any read through the API can collapse into. */
export type DirectoryGatewayError = TaggedError<
  'app/access-gateway-error' | 'app/access-denied'
>;

/**
 * Client-side view of the access system. On SPA/native, authorization lives
 * server-side (the API resolves the actor per request); the client only
 * *reads* its computed access snapshot to gate what it renders. This port is
 * implemented by an adapter that calls the API's `access.current` procedure
 * with the bearer token attached.
 */
export type CurrentAccessGateway = {
  readonly fetchCurrentAccess: () => Promise<
    Result<
      CurrentAccessDto,
      TaggedError<'app/access-gateway-error' | 'app/access-denied'>
    >
  >;
  /**
   * "Log me out everywhere": revokes every active session of the CALLER's own
   * membership through the API (the adapter resolves the membership first).
   * The current session dies too — follow with a fresh sign-in.
   */
  readonly revokeOwnSessions: () => Promise<
    Result<
      { readonly revoked: number },
      TaggedError<'app/access-gateway-error' | 'app/access-denied'>
    >
  >;
};

/**
 * Client-side view of the platform directory the admin dashboard renders.
 * Both calls hit API procedures with the bearer token attached; the server
 * reauthorizes every one (`staff.read` / `customer.search`). The client only
 * reads — it never decides who may see what.
 */
export type DirectoryGateway = {
  readonly listStaff: () => Promise<
    Result<ReadonlyArray<StaffAccountSummary>, DirectoryGatewayError>
  >;
  readonly listCustomers: () => Promise<
    Result<ReadonlyArray<CustomerAccountSummary>, DirectoryGatewayError>
  >;
};

/** Admin issues an invitation (authenticated `members.invite`). */
export type InviteInput = {
  readonly accountId: string;
  readonly email: string;
  readonly permissions: ReadonlyArray<{
    readonly action: string;
    readonly scope: string;
  }>;
};

export type InvitationsGateway = {
  readonly invite: (
    input: InviteInput,
  ) => Promise<
    Result<
      { readonly invitationId: string; readonly token: string },
      DirectoryGatewayError
    >
  >;
};

/** The failure modes the public activation endpoint can surface to the client. */
export type ActivationGatewayError = TaggedError<
  | 'app/invitation-token-invalid'
  | 'app/identity-already-exists'
  | 'app/identity-provision-failed'
  | 'app/access-gateway-error'
>;

/** One member as the dashboard's permissions editor sees it. */
export type MemberSummaryDto = {
  readonly membershipId: string;
  readonly userId: string;
  readonly permissions: ReadonlyArray<{
    readonly action: string;
    readonly scope: string;
  }>;
  /** The protected super-admin — the editor must not offer to change it. */
  readonly isRoot: boolean;
  /** Soft-blocked within this org — the toggle reflects this state. */
  readonly blocked: boolean;
};

/**
 * Errors the permissions editor surfaces. The transport exposes only status,
 * so a denial (including the super-admin protection, which the server returns
 * as a generic access-denied) and any other failure collapse to these two.
 */
export type ManagePermissionsError = TaggedError<
  'app/access-denied' | 'app/access-gateway-error'
>;

/** Authenticated member administration for the dashboard and client org admin. */
export type MembersGateway = {
  readonly listMembers: (
    accountId: string,
  ) => Promise<Result<ReadonlyArray<MemberSummaryDto>, DirectoryGatewayError>>;
  readonly updatePermissions: (input: {
    readonly membershipId: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }) => Promise<Result<void, ManagePermissionsError>>;
  /** Remove a member from their account; never your own membership. */
  readonly removeMember: (input: {
    readonly membershipId: string;
  }) => Promise<Result<void, ManagePermissionsError>>;
  /** Soft-block / unblock one member inside the caller's own org. */
  readonly setMemberBlocked: (input: {
    readonly membershipId: string;
    readonly blocked: boolean;
  }) => Promise<Result<void, ManagePermissionsError>>;
};

/** One of the caller's organizations, for the client's org switcher. */
export type MyMembershipDto = {
  readonly membershipId: string;
  readonly accountId: string;
  readonly accountKind: string;
  readonly accountStatus: string;
  readonly accountName: string | null;
};

/** Self-service multi-org for the client app: create/list orgs + switch session. */
export type OrgsGateway = {
  /** Identity-level (works org-less): create my own org, becoming its admin. */
  readonly createOrganization: (
    name: string,
  ) => Promise<Result<{ readonly accountId: string }, DirectoryGatewayError>>;
  readonly listMyMemberships: () => Promise<
    Result<ReadonlyArray<MyMembershipDto>, DirectoryGatewayError>
  >;
  readonly switchAccount: (
    membershipId: string,
  ) => Promise<Result<{ readonly accountId: string }, DirectoryGatewayError>>;
};

/** Soft block / unblock of an org (account) or an identity (user). */
export type BlockGateway = {
  readonly blockOrg: (
    accountId: string,
    reason?: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  readonly unblockOrg: (
    accountId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  readonly blockIdentity: (
    userId: string,
    reason?: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
  readonly unblockIdentity: (
    userId: string,
  ) => Promise<Result<void, DirectoryGatewayError>>;
};

/** Pre-login activation — no bearer token, the secret token is the credential. */
export type ActivationGateway = {
  readonly activate: (input: {
    readonly token: string;
    readonly password: string;
  }) => Promise<Result<{ readonly email: string }, ActivationGatewayError>>;
};
