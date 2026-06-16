import type { Result } from '@acme/shared';
import type { StaffAccountSummary } from '../../access-directory/ports';
import type { CustomerAccountSummary } from '../../impersonation/ports';
import type { DirectoryGateway, DirectoryGatewayError } from '../ports';

/**
 * The directory bundle the admin dashboard consumes: two read flows that the
 * server reauthorizes. Thin on purpose — like the rest of the access client,
 * it only forwards to the gateway; every real decision is server-side.
 */
export type DirectoryUseCases = {
  readonly listStaff: () => Promise<
    Result<ReadonlyArray<StaffAccountSummary>, DirectoryGatewayError>
  >;
  readonly listCustomers: () => Promise<
    Result<ReadonlyArray<CustomerAccountSummary>, DirectoryGatewayError>
  >;
};

export const makeDirectoryUseCases = (deps: {
  readonly gateway: DirectoryGateway;
}): DirectoryUseCases => ({
  listStaff: () => deps.gateway.listStaff(),
  listCustomers: () => deps.gateway.listCustomers(),
});
