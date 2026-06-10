import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeAccountId } from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { customerNotFound } from './errors';
import type { ImpersonationUseCaseError } from './errors';
import type {
  CustomerAccountDetails,
  CustomerAccountSummary,
  CustomerDirectory,
} from './ports';

export type CustomerReadDeps = {
  readonly customers: CustomerDirectory;
  readonly clock: Clock;
};

export const makeSearchCustomers =
  (deps: CustomerReadDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly query: string;
  }): Promise<
    Result<ReadonlyArray<CustomerAccountSummary>, ImpersonationUseCaseError>
  > => {
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'customer.search',
      resource: { accountId: null },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.customers.search(input.query.trim()));
  };

/**
 * Reading a customer account is authorized by the policy alone: a customer
 * reads their own account via an `own`-scoped permission; support reads it
 * only through an active impersonation grant on that exact account.
 */
export const makeReadCustomerAsSupport =
  (deps: CustomerReadDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<Result<CustomerAccountDetails, ImpersonationUseCaseError>> => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'customer.read',
      resource: { accountId: accountId.value },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);

    const customer = await deps.customers.read(accountId.value);
    if (!customer) {
      return err(customerNotFound(`No customer ${input.accountId}.`));
    }
    return ok(customer);
  };
