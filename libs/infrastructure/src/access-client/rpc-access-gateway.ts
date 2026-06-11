import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  CurrentAccessDto,
  CurrentAccessGateway,
} from '@acme/application';

/**
 * Client-side adapter for `CurrentAccessGateway`: calls the API's
 * `access.current` procedure through the `ApiClient` port (which attaches the
 * bearer token via the wired `AuthProvider`). 401/403 collapse into
 * `app/access-denied`; any other transport failure is a gateway error.
 */
type RpcEnvelope = { readonly data: CurrentAccessDto };

export const createRpcAccessGateway = (deps: {
  readonly api: ApiClient;
}): CurrentAccessGateway => ({
  fetchCurrentAccess: async (): Promise<
    Result<
      CurrentAccessDto,
      ReturnType<typeof accessGatewayError> | ReturnType<typeof accessDenied>
    >
  > => {
    const response = await deps.api.request<RpcEnvelope>({
      operation: 'access.current',
      method: 'POST',
      path: 'rpc/access.current',
      body: {},
    });
    if (!response.ok) {
      if (response.error.status === 401 || response.error.status === 403) {
        return err(accessDenied('Not authorized for access.current.'));
      }
      return err(accessGatewayError(response.error.message));
    }
    return ok(response.value.data);
  },
});
