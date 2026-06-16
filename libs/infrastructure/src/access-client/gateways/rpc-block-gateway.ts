import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  BlockGateway,
  DirectoryGatewayError,
} from '@acme/application';

const call = async (
  api: ApiClient,
  name: string,
  body: unknown,
): Promise<Result<void, DirectoryGatewayError>> => {
  const response = await api.request<{ readonly data: unknown }>({
    operation: name,
    method: 'POST',
    path: `rpc/${name}`,
    body,
  });
  if (!response.ok) {
    const error: DirectoryGatewayError =
      response.error.status === 401 || response.error.status === 403
        ? accessDenied(`Not authorized for ${name}.`)
        : accessGatewayError(response.error.message);
    return err(error) as Result<void, DirectoryGatewayError>;
  }
  return ok(undefined);
};

/** Authenticated soft-block adapter over the `org.*` / `identity.*` procedures. */
export const createRpcBlockGateway = (deps: {
  readonly api: ApiClient;
}): BlockGateway => ({
  blockOrg: (accountId, reason) =>
    call(deps.api, 'org.block', { accountId, ...(reason ? { reason } : {}) }),
  unblockOrg: (accountId) => call(deps.api, 'org.unblock', { accountId }),
  blockIdentity: (userId, reason) =>
    call(deps.api, 'identity.block', {
      userId,
      ...(reason ? { reason } : {}),
    }),
  unblockIdentity: (userId) => call(deps.api, 'identity.unblock', { userId }),
});
