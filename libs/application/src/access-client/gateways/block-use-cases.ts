import type { Result } from '@acme/shared';
import type { BlockGateway, DirectoryGatewayError } from '../ports';

/**
 * Soft-block flows the dashboard consumes — block/unblock an org or an
 * identity. Thin forwarders; the server enforces the permission and the
 * super-admin protection.
 */
type VoidResult = Promise<Result<void, DirectoryGatewayError>>;

export type BlockUseCases = {
  readonly blockOrg: (accountId: string, reason?: string) => VoidResult;
  readonly unblockOrg: (accountId: string) => VoidResult;
  readonly blockIdentity: (userId: string, reason?: string) => VoidResult;
  readonly unblockIdentity: (userId: string) => VoidResult;
};

export const makeBlockUseCases = (deps: {
  readonly gateway: BlockGateway;
}): BlockUseCases => ({
  blockOrg: (accountId, reason) => deps.gateway.blockOrg(accountId, reason),
  unblockOrg: (accountId) => deps.gateway.unblockOrg(accountId),
  blockIdentity: (userId, reason) => deps.gateway.blockIdentity(userId, reason),
  unblockIdentity: (userId) => deps.gateway.unblockIdentity(userId),
});
