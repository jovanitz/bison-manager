import {
  type Clock,
  type IdGenerator,
  type Result,
  type TaggedError,
  defineError,
  err,
  ok,
} from '@acme/shared';
import { accessPresetPermissions } from '@acme/domain';
import type { AccountId, MembershipId, UserId } from '@acme/domain';
import type { IdentityOnboardingRepository } from './ports';

export const invalidOrgName = defineError('app/invalid-org-name');
export type CreateOrganizationError = TaggedError<'app/invalid-org-name'>;

export type CreateOrganizationDeps = {
  readonly onboarding: Pick<
    IdentityOnboardingRepository,
    'createCustomerMembership'
  >;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

/**
 * Identity-level: a signed-in but ORG-LESS user creates their own organization
 * and becomes its admin (`customer-admin`). Runs off the verified identity
 * (userId/email from the JWT) — there is no actor yet, by definition. After
 * this the user has a membership, so the normal actor path resolves on the next
 * request.
 */
export const makeCreateOrganization =
  (deps: CreateOrganizationDeps) =>
  async (input: {
    readonly userId: string;
    readonly email: string | null;
    readonly name: string;
  }): Promise<
    Result<
      { readonly accountId: string; readonly membershipId: string },
      CreateOrganizationError
    >
  > => {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 200) {
      return err(invalidOrgName('An organization name is required.'));
    }
    const membershipId = deps.ids.next() as MembershipId;
    const accountId = deps.ids.next() as AccountId;
    await deps.onboarding.createCustomerMembership({
      membershipId,
      accountId,
      userId: input.userId as UserId,
      email: input.email,
      displayName: name,
      permissions: accessPresetPermissions('customer-admin'),
      occurredAt: deps.clock.now().toISOString(),
    });
    return ok({ accountId, membershipId });
  };

export type CreateOrganizationUseCases = {
  readonly createOrganization: ReturnType<typeof makeCreateOrganization>;
};

export const makeCreateOrganizationUseCases = (
  deps: CreateOrganizationDeps,
): CreateOrganizationUseCases => ({
  createOrganization: makeCreateOrganization(deps),
});
