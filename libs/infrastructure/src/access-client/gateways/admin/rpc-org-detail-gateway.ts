import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  DirectoryGatewayError,
  OrgDetailGateway,
  OrgMemberDto,
  OrgSummaryDto,
} from '@acme/application';

/**
 * Client-side adapter for `OrgDetailGateway`: the customer (org) detail
 * drill-down. Calls the API's `org.summary` and `org.members` procedures through
 * the `ApiClient` port (bearer attached); the server reauthorizes every call
 * (`customer.search` / `members.read`). 401/403 collapse into `app/access-denied`,
 * any other failure into a gateway error — same translation as the other gateways.
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

export const createRpcOrgDetailGateway = (deps: {
  readonly api: ApiClient;
}): OrgDetailGateway => ({
  getSummary: (accountId) =>
    callProcedure<OrgSummaryDto>(deps.api, 'org.summary', { accountId }),
  listMembers: (accountId) =>
    callProcedure<ReadonlyArray<OrgMemberDto>>(deps.api, 'org.members', {
      accountId,
    }),
});
