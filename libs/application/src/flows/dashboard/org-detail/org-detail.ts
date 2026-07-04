import { type Result, err, ok } from '@acme/shared';
import type { AccessClientUseCases } from '../../../access-client/use-cases';
import type {
  OrgDetailGateway,
  OrgMemberDto,
} from '../../../access-client/ports';
import { holdsAction } from '../../capabilities';
import type { DashboardError } from '../queries';

/** The customer (org) detail screen: admin summary + roster + capabilities. */
export type OrgDetailViewModel = {
  readonly accountId: string;
  readonly name: string;
  readonly email: string | null;
  readonly status: string;
  readonly createdAt: string;
  /** Derived from the roster (the member holding the owner role). */
  readonly owner: {
    readonly name: string;
    readonly email: string | null;
  } | null;
  /** Actor holds `members.read` → the roster is shown (administrative, no grant). */
  readonly canViewMembers: boolean;
  /** Actor can start impersonation ("view as customer") — a SEPARATE action. */
  readonly canImpersonate: boolean;
  readonly members: ReadonlyArray<OrgMemberDto>;
};

/**
 * Loads a customer org's detail for the directory drill-down. The roster is an
 * administrative read gated by `members.read` (staff any / org admin own) — NOT
 * impersonation. "View as customer" (`impersonation.start`) is offered
 * separately. Owner is derived from the roster; when the actor lacks
 * `members.read` the roster is empty and the screen shows the gated state.
 */
export const loadOrgDetail = async (
  deps: {
    readonly access: AccessClientUseCases;
    readonly orgs: OrgDetailGateway;
  },
  input: { readonly accountId: string },
): Promise<Result<OrgDetailViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const access = snapshot.value;

  const summary = await deps.orgs.getSummary(input.accountId);
  if (!summary.ok) return err(summary.error);

  const canViewMembers = holdsAction(access, 'members.read');
  const roster = canViewMembers
    ? await deps.orgs.listMembers(input.accountId)
    : ok([] as ReadonlyArray<OrgMemberDto>);
  if (!roster.ok) return err(roster.error);

  const ownerEntry = roster.value.find((m) => m.isAccountOwner);
  return ok({
    accountId: summary.value.accountId,
    name: summary.value.name,
    email: summary.value.email,
    status: summary.value.status,
    createdAt: summary.value.createdAt,
    owner: ownerEntry
      ? {
          name: ownerEntry.displayName ?? ownerEntry.email ?? ownerEntry.userId,
          email: ownerEntry.email,
        }
      : null,
    canViewMembers,
    canImpersonate: holdsAction(access, 'impersonation.start'),
    members: roster.value,
  });
};
