import type {
  AccessAdminRepository,
  AccessMemberDirectory,
  CustomerDirectory,
  OrgDetailReader,
  OrgMemberEntry,
  RoleStore,
} from '@acme/application';

/**
 * The customer (org) detail reader — COMPOSED over existing ports, so the same
 * factory works over any store (in-memory today, Postgres unchanged). These are
 * ADMINISTRATIVE reads (the use cases gate them with `customer.search` /
 * `members.read`), never impersonation:
 * - summary from the customer directory,
 * - roster from the member directory, enriched with role names (role store) and
 *   ownership (admin repository).
 *
 * A member's display name / email is not modelled by every store (the in-memory
 * one has no identity profiles), so it is left `null`; a store that joins the
 * auth provider populates them without touching this composition.
 */
export const makeOrgDetailReader = (deps: {
  readonly customers: Pick<CustomerDirectory, 'read'>;
  readonly members: Pick<AccessMemberDirectory, 'listMembers'>;
  readonly admin: Pick<AccessAdminRepository, 'findMembership'>;
  readonly roles: Pick<RoleStore, 'list'>;
}): OrgDetailReader => ({
  readSummary: async (accountId) => {
    const details = await deps.customers.read(accountId);
    if (!details) return null;
    return {
      accountId: details.accountId,
      name: details.displayName,
      email: details.email,
      status: details.status,
      createdAt: details.createdAt,
    };
  },

  listMembers: async (accountId) => {
    const snapshots = await deps.members.listMembers(accountId);
    const [platformRoles, accountRoles] = await Promise.all([
      deps.roles.list(null),
      deps.roles.list(accountId),
    ]);
    const nameById = new Map(
      [...platformRoles, ...accountRoles].map((r) => [r.id, r.name] as const),
    );
    return Promise.all(
      snapshots.map(async (s): Promise<OrgMemberEntry> => {
        const membership = await deps.admin.findMembership(s.membershipId);
        return {
          membershipId: s.membershipId,
          userId: s.userId,
          displayName: null,
          email: null,
          roleNames: s.roleIds.map((rid) => nameById.get(rid) ?? rid),
          isAccountOwner: membership?.isAccountOwner ?? false,
          isRoot: s.isRoot,
          blocked: s.blocked,
        };
      }),
    );
  },
});
