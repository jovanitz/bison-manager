import type { ApiClient, CoverageDto, CoverageReader } from '@acme/application';

/**
 * Client-side adapter for the `CoverageReader` gateway (ADR-0018): reads an
 * org's derived billing coverage from the API's `billing.coverage` procedure
 * (the server reauthorizes `billing.read`). Fail-soft by contract — any error
 * (network, 403, gateway) collapses to `null`, so one org's billing hiccup
 * never blanks the whole directory listing.
 */
export const createRpcCoverageGateway = (deps: {
  readonly api: ApiClient;
}): CoverageReader => ({
  coverageFor: async (accountId): Promise<CoverageDto | null> => {
    const response = await deps.api.request<{
      readonly data: CoverageDto | null;
    }>({
      operation: 'billing.coverage',
      method: 'POST',
      path: 'rpc/billing.coverage',
      body: { accountId },
    });
    return response.ok ? response.value.data : null;
  },
});
