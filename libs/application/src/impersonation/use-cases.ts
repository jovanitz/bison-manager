import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import {
  IMPERSONATION_GRANT_DEFAULT_MINUTES,
  IMPERSONATION_GRANT_MAX_MINUTES,
  createImpersonationGrant,
  endImpersonationGrant,
  makeAccessGrantId,
  makeAccountId,
} from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { type AccessGrantDto, toAccessGrantDto } from '../access/dto';
import {
  makeReadCustomerAsSupport,
  makeSearchCustomers,
} from './customer-use-cases';
import {
  customerNotFound,
  impersonationGrantNotFound,
  impersonationGrantNotOwned,
} from './errors';
import type { ImpersonationUseCaseError } from './errors';
import type { AccessGrantRepository, CustomerDirectory } from './ports';

export type ImpersonationDeps = {
  readonly grants: AccessGrantRepository;
  readonly customers: CustomerDirectory;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

const MINUTE_MS = 60_000;

/**
 * Support opens a view-only window into one customer account. The actor stays
 * the support agent — we never mint a token as the customer. What changes is
 * the actor's grants: an allowlisted, expiring, reasoned grant that the policy
 * then honours for `customer.read` on that single account.
 */
export const makeStartImpersonation =
  (deps: ImpersonationDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly targetAccountId: string;
    readonly reason: string;
    readonly durationMinutes?: number;
  }): Promise<Result<AccessGrantDto, ImpersonationUseCaseError>> => {
    const targetAccountId = makeAccountId(input.targetAccountId);
    if (!targetAccountId.ok) return err(targetAccountId.error);
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'impersonation.start',
      resource: { accountId: targetAccountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const customer = await deps.customers.read(targetAccountId.value);
    if (!customer) {
      return err(customerNotFound(`No customer ${input.targetAccountId}.`));
    }

    const grantId = makeAccessGrantId(deps.ids.next());
    if (!grantId.ok) return err(grantId.error);
    const minutes = Math.min(
      input.durationMinutes ?? IMPERSONATION_GRANT_DEFAULT_MINUTES,
      IMPERSONATION_GRANT_MAX_MINUTES,
    );
    const expiresAt = new Date(
      deps.clock.now().getTime() + minutes * MINUTE_MS,
    ).toISOString();

    const created = createImpersonationGrant({
      id: grantId.value,
      membershipId: input.actor.membership.id,
      targetAccountId: targetAccountId.value,
      reason: input.reason,
      occurredAt: now,
      expiresAt,
    });
    if (!created.ok) return err(created.error);

    await deps.grants.saveNew(created.value.grant, created.value.event);
    return ok(toAccessGrantDto(created.value.grant));
  };

export const makeEndImpersonation =
  (deps: ImpersonationDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly grantId: string;
  }): Promise<Result<void, ImpersonationUseCaseError>> => {
    const grantId = makeAccessGrantId(input.grantId);
    if (!grantId.ok) return err(grantId.error);

    const grant = await deps.grants.findById(grantId.value);
    if (!grant) {
      return err(impersonationGrantNotFound(`No grant ${input.grantId}.`));
    }
    if (grant.membershipId !== input.actor.membership.id) {
      return err(
        impersonationGrantNotOwned('Only the grant holder may end it.'),
      );
    }

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'impersonation.end',
      resource: { accountId: grant.targetAccountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const ended = endImpersonationGrant(grant, now);
    if (!ended.ok) return err(ended.error);

    await deps.grants.saveEnded(ended.value.grant, ended.value.event);
    return ok(undefined);
  };

export type ImpersonationUseCases = {
  readonly startImpersonation: ReturnType<typeof makeStartImpersonation>;
  readonly endImpersonation: ReturnType<typeof makeEndImpersonation>;
  readonly searchCustomers: ReturnType<typeof makeSearchCustomers>;
  readonly readCustomerAsSupport: ReturnType<typeof makeReadCustomerAsSupport>;
};

export const makeImpersonationUseCases = (
  deps: ImpersonationDeps,
): ImpersonationUseCases => ({
  startImpersonation: makeStartImpersonation(deps),
  endImpersonation: makeEndImpersonation(deps),
  searchCustomers: makeSearchCustomers(deps),
  readCustomerAsSupport: makeReadCustomerAsSupport(deps),
});
