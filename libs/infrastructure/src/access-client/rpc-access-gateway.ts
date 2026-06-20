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
type GatewayError =
  | ReturnType<typeof accessGatewayError>
  | ReturnType<typeof accessDenied>;

const callProcedure = async <T>(
  api: ApiClient,
  name: string,
  body: unknown,
): Promise<Result<T, GatewayError>> => {
  const response = await api.request<{ readonly data: T }>({
    operation: name,
    method: 'POST',
    path: `rpc/${name}`,
    body,
  });
  if (!response.ok) {
    if (response.error.status === 401 || response.error.status === 403) {
      return err(accessDenied(`Not authorized for ${name}.`));
    }
    return err(accessGatewayError(response.error.message));
  }
  return ok(response.value.data);
};

export const createRpcAccessGateway = (deps: {
  readonly api: ApiClient;
}): CurrentAccessGateway => ({
  fetchCurrentAccess: () =>
    callProcedure<CurrentAccessDto>(deps.api, 'access.current', {}),

  revokeOwnSessions: async () => {
    // The caller's own membership comes from the snapshot — the client never
    // guesses ids, and `sessions.revoke` own-scope authorizes the rest.
    const current = await callProcedure<CurrentAccessDto>(
      deps.api,
      'access.current',
      {},
    );
    if (!current.ok) return err(current.error);
    return callProcedure<{ readonly revoked: number }>(
      deps.api,
      'sessions.revoke-all',
      { membershipId: current.value.membershipId },
    );
  },

  // Public, pre-auth GET (not an `/rpc` procedure, no bearer needed): the server
  // returns whether the instance still needs its first owner.
  needsBootstrap: async () => {
    const response = await deps.api.request<{
      readonly needsBootstrap: boolean;
    }>({
      operation: 'bootstrap-status',
      method: 'GET',
      path: 'bootstrap-status',
    });
    return response.ok
      ? ok(response.value.needsBootstrap)
      : err(accessGatewayError(response.error.message));
  },
});
