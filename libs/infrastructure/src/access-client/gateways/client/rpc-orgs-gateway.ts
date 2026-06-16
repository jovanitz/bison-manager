import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  MyMembershipDto,
  OrgsGateway,
} from '@acme/application';

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

/**
 * Client adapter for the self-service multi-org procedures: `memberships.mine`
 * (the org switcher's list) and `session.switch-account` (re-bind the session).
 */
export const createRpcOrgsGateway = (deps: {
  readonly api: ApiClient;
}): OrgsGateway => ({
  // Identity-level endpoint (works org-less): POST /id/create-organization.
  createOrganization: async (name) => {
    const response = await deps.api.request<{
      readonly data: { readonly accountId: string };
    }>({
      operation: 'create-organization',
      method: 'POST',
      path: 'id/create-organization',
      body: { name },
    });
    if (!response.ok) {
      if (response.error.status === 401 || response.error.status === 403) {
        return err(accessDenied('Not authorized to create an organization.'));
      }
      return err(accessGatewayError(response.error.message));
    }
    return ok(response.value.data);
  },
  listMyMemberships: () =>
    callProcedure<ReadonlyArray<MyMembershipDto>>(
      deps.api,
      'memberships.mine',
      {},
    ),
  switchAccount: (membershipId) =>
    callProcedure<{ readonly accountId: string }>(
      deps.api,
      'session.switch-account',
      { membershipId },
    ),
});
