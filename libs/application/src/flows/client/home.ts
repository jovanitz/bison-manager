import { type Result, type TaggedError, err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type { MyMembershipDto } from '../../access-client/ports';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { OrgsUseCases } from '../../access-client/gateways/client/orgs-use-cases';

/**
 * The client home controller: the caller's current access snapshot plus their
 * organizations (the switcher), and the self-service org commands. Headless —
 * mirrors `useHomeData` + the switch/create handlers, minus React.
 */
export type HomeDeps = {
  readonly access: AccessClientUseCases;
  readonly orgs: OrgsUseCases;
};

export type HomeViewModel = {
  readonly access: CurrentAccessDto;
  readonly orgs: ReadonlyArray<MyMembershipDto>;
};

export type HomeError = TaggedError<
  'app/access-denied' | 'app/access-gateway-error'
>;

/** Query: load the access snapshot + the caller's organizations together. */
export const loadHome = async (
  deps: HomeDeps,
): Promise<Result<HomeViewModel, HomeError>> => {
  const [snapshot, mine] = await Promise.all([
    deps.access.currentAccess(),
    deps.orgs.listMyMemberships(),
  ]);
  if (!snapshot.ok) return err(snapshot.error);
  return ok({ access: snapshot.value, orgs: mine.ok ? mine.value : [] });
};

/** Command: re-bind the live session to another of the caller's memberships. */
export const switchOrg = (
  deps: HomeDeps,
  input: { readonly membershipId: string },
): Promise<Result<{ readonly accountId: string }, HomeError>> =>
  deps.orgs.switchAccount(input.membershipId);

/** Command: create a new organization (the caller becomes its admin). */
export const createOrg = (
  deps: HomeDeps,
  input: { readonly name: string },
): Promise<Result<{ readonly accountId: string }, HomeError>> =>
  deps.orgs.createOrganization(input.name);
