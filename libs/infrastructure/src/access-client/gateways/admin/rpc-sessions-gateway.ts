import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  AdminSessionDto,
  ApiClient,
  DirectoryGatewayError,
  SessionsGateway,
} from '@acme/application';

const callVoid = async (
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

/** Authenticated active-session admin over the `sessions.*` procedures. */
export const createRpcSessionsGateway = (deps: {
  readonly api: ApiClient;
}): SessionsGateway => ({
  list: async (membershipId) => {
    const response = await deps.api.request<{
      readonly data: ReadonlyArray<AdminSessionDto>;
    }>({
      operation: 'sessions.list',
      method: 'POST',
      path: 'rpc/sessions.list',
      body: { membershipId },
    });
    if (!response.ok) {
      const error: DirectoryGatewayError =
        response.error.status === 401 || response.error.status === 403
          ? accessDenied('Not authorized for sessions.list.')
          : accessGatewayError(response.error.message);
      return err(error);
    }
    return ok(response.value.data);
  },
  revoke: (sessionId) => callVoid(deps.api, 'sessions.revoke', { sessionId }),
  revokeAll: (membershipId) =>
    callVoid(deps.api, 'sessions.revoke-all', { membershipId }),
});
