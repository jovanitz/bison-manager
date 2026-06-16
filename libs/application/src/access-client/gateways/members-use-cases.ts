import type { Result } from '@acme/shared';
import type {
  DirectoryGatewayError,
  ManagePermissionsError,
  MemberSummaryDto,
  MembersGateway,
} from '../ports';

/**
 * Member administration the dashboard consumes: list an account's members and
 * replace a member's permissions. Thin forwarders — every decision (including
 * the super-admin protection) is server-side.
 */
export type MembersUseCases = {
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
  readonly removeMember: (input: {
    readonly membershipId: string;
  }) => Promise<Result<void, ManagePermissionsError>>;
  readonly setMemberBlocked: (input: {
    readonly membershipId: string;
    readonly blocked: boolean;
  }) => Promise<Result<void, ManagePermissionsError>>;
};

export const makeMembersUseCases = (deps: {
  readonly gateway: MembersGateway;
}): MembersUseCases => ({
  listMembers: (accountId) => deps.gateway.listMembers(accountId),
  updatePermissions: (input) => deps.gateway.updatePermissions(input),
  removeMember: (input) => deps.gateway.removeMember(input),
  setMemberBlocked: (input) => deps.gateway.setMemberBlocked(input),
});
