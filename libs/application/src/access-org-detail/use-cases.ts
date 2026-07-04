import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeAccountId, type AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { accountNotFound } from '../access-admin/errors';
import type { AccessOrgDetailUseCaseError } from './errors';
import type { OrgAdminSummary, OrgDetailReader, OrgMemberEntry } from './ports';

export type AccessOrgDetailDeps = {
  readonly orgs: OrgDetailReader;
  readonly clock: Clock;
};

/**
 * Administrative metadata of one customer org. Gated by `customer.search` — the
 * staff-scope permission that also lists the directory, so a staffer who can
 * browse customers can read a customer's basic admin metadata. NOT `customer.read`
 * (that grant-only action stays for impersonation / deeper customer data).
 */
export const makeGetOrgSummary =
  (deps: AccessOrgDetailDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<Result<OrgAdminSummary, AccessOrgDetailUseCaseError>> => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'customer.search',
      resource: { accountId: null },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);

    const summary = await deps.orgs.readSummary(accountId.value);
    if (!summary) return err(accountNotFound(`No account ${input.accountId}.`));
    return ok(summary);
  };

/**
 * The member roster of one org — an ADMINISTRATIVE read, not impersonation.
 * Gated by `members.read`: staff hold it at `any` (every org), an org admin at
 * `own` (their account only). The same use case, different permission scope.
 */
export const makeListOrgMembers =
  (deps: AccessOrgDetailDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<
    Result<ReadonlyArray<OrgMemberEntry>, AccessOrgDetailUseCaseError>
  > => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'members.read',
      resource: { accountId: accountId.value },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);

    return ok(await deps.orgs.listMembers(accountId.value));
  };

export type AccessOrgDetailUseCases = {
  readonly getOrgSummary: ReturnType<typeof makeGetOrgSummary>;
  readonly listOrgMembers: ReturnType<typeof makeListOrgMembers>;
};

export const makeAccessOrgDetailUseCases = (
  deps: AccessOrgDetailDeps,
): AccessOrgDetailUseCases => ({
  getOrgSummary: makeGetOrgSummary(deps),
  listOrgMembers: makeListOrgMembers(deps),
});
