import { err, ok } from '@acme/shared';
import { accessDenied, accessGatewayError } from '@acme/application';
import type {
  ApiClient,
  AuditGateway,
  AuditRecordDto,
  DirectoryGatewayError,
} from '@acme/application';

/** Authenticated read of the audit trail over the `audit.list` procedure. */
export const createRpcAuditGateway = (deps: {
  readonly api: ApiClient;
}): AuditGateway => ({
  list: async (filter) => {
    const response = await deps.api.request<{
      readonly data: ReadonlyArray<AuditRecordDto>;
    }>({
      operation: 'audit.list',
      method: 'POST',
      path: 'rpc/audit.list',
      body: {
        ...(filter?.accountId ? { accountId: filter.accountId } : {}),
        ...(filter?.limit ? { limit: filter.limit } : {}),
      },
    });
    if (!response.ok) {
      const error: DirectoryGatewayError =
        response.error.status === 401 || response.error.status === 403
          ? accessDenied('Not authorized for audit.list.')
          : accessGatewayError(response.error.message);
      return err(error);
    }
    return ok(response.value.data);
  },
});
