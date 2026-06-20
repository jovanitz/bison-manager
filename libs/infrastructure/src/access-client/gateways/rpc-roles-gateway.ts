import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  RolesGateway,
  RoleSummaryDto,
} from '@acme/application';

/**
 * Client-side adapter for `RolesGateway` (ADR-0011): the dashboard's role
 * management over the API's `roles.*` procedures, via the `ApiClient` port
 * (which attaches the bearer token). 401/403 collapse into `app/access-denied`;
 * any other failure is a gateway error — same translation as the other gateways.
 */
const callProcedure = async <T>(
  api: ApiClient,
  name: string,
  body: unknown,
): Promise<Result<T, DirectoryGatewayError>> => {
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

export const createRpcRolesGateway = (deps: {
  readonly api: ApiClient;
}): RolesGateway => ({
  listRoles: (accountId) =>
    callProcedure<ReadonlyArray<RoleSummaryDto>>(deps.api, 'roles.list', {
      accountId,
    }),
  createRole: (input) =>
    callProcedure<{ readonly roleId: string }>(deps.api, 'roles.create', input),
  deleteRole: async (roleId) => {
    const result = await callProcedure<null>(deps.api, 'roles.delete', {
      roleId,
    });
    return result.ok ? ok(undefined) : result;
  },
  assignRoles: async (input) => {
    const result = await callProcedure<null>(deps.api, 'roles.assign', input);
    return result.ok ? ok(undefined) : result;
  },
});
