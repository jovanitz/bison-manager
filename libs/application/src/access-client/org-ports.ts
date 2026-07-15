import type { Result } from '@acme/shared';
import type { DirectoryGatewayError } from './errors';

/**
 * The ORG-shaped half of the access client: the staff drill-down into one
 * customer org, and the customer's own multi-org self-service. Split out of
 * `ports.ts` to keep that file readable — same layer, same rules.
 */
/** A customer org's admin metadata for the directory drill-down (no grant). */
export type OrgSummaryDto = {
  readonly accountId: string;
  readonly name: string;
  readonly email: string | null;
  readonly status: string;
  readonly createdAt: string;
};

/** One member as the org-detail roster shows it (display-oriented). */
export type OrgMemberDto = {
  readonly membershipId: string;
  readonly userId: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly roleNames: ReadonlyArray<string>;
  readonly isAccountOwner: boolean;
  readonly isRoot: boolean;
  readonly blocked: boolean;
};

/**
 * The customer (org) detail drill-down the dashboard consumes. Both calls hit
 * API procedures (bearer attached); the server reauthorizes — `customer.search`
 * for the summary, `members.read` for the roster. Administrative reads, NOT
 * impersonation (`customer.read` / acting-as stays its own grant-gated flow).
 */
export type OrgDetailGateway = {
  readonly getSummary: (
    accountId: string,
  ) => Promise<Result<OrgSummaryDto, DirectoryGatewayError>>;
  readonly listMembers: (
    accountId: string,
  ) => Promise<Result<ReadonlyArray<OrgMemberDto>, DirectoryGatewayError>>;
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