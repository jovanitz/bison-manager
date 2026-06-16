import type { Result } from '@acme/shared';
import type {
  DirectoryGatewayError,
  MyMembershipDto,
  OrgsGateway,
} from '../../ports';

/**
 * The self-service multi-org flows the client app consumes: list the caller's
 * organizations and re-bind the session to another. Thin forwarders — the
 * server decides everything (a switch target must be one of yours).
 */
export type OrgsUseCases = {
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

export const makeOrgsUseCases = (deps: {
  readonly gateway: OrgsGateway;
}): OrgsUseCases => ({
  createOrganization: (name) => deps.gateway.createOrganization(name),
  listMyMemberships: () => deps.gateway.listMyMemberships(),
  switchAccount: (membershipId) => deps.gateway.switchAccount(membershipId),
});
