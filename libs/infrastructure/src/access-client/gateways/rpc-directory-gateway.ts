import { type Result, err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  CustomerDirectoryEntry,
  DirectoryGateway,
  DirectoryGatewayError,
  OrphanIdentitySummary,
  StaffAccountSummary,
} from '@acme/application';

/**
 * Client-side adapter for `DirectoryGateway`: the admin dashboard's read of the
 * staff/customer tables. It calls the API's `staff.list` and `customer.search`
 * procedures through the `ApiClient` port (which attaches the bearer token).
 * 401/403 collapse into `app/access-denied`; any other failure is a gateway
 * error — the same translation `rpc-access-gateway` uses.
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

export const createRpcDirectoryGateway = (deps: {
  readonly api: ApiClient;
}): DirectoryGateway => ({
  listStaff: () =>
    callProcedure<ReadonlyArray<StaffAccountSummary>>(
      deps.api,
      'staff.list',
      {},
    ),
  listCustomers: () =>
    callProcedure<ReadonlyArray<CustomerDirectoryEntry>>(
      deps.api,
      'customers.list',
      {},
    ),
  listOrphans: () =>
    callProcedure<ReadonlyArray<OrphanIdentitySummary>>(
      deps.api,
      'identities.orphaned',
      {},
    ),
  purgeOrphan: (userId) =>
    callProcedure<void>(deps.api, 'identities.delete', { userId }),
});
