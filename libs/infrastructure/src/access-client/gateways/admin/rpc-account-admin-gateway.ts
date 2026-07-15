import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  AccountAdminGateway,
  ApiClient,
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

/** Authenticated account-lifecycle adapter over the `account.*` procedures. */
export const createRpcAccountAdminGateway = (deps: {
  readonly api: ApiClient;
}): AccountAdminGateway => ({
  disable: (accountId, reason) =>
    call(deps.api, 'account.disable', {
      accountId,
      ...(reason ? { reason } : {}),
    }),
  enable: (accountId) => call(deps.api, 'account.enable', { accountId }),
  promote: (accountId) => call(deps.api, 'account.promote', { accountId }),
  demote: (accountId) => call(deps.api, 'account.demote', { accountId }),
});
