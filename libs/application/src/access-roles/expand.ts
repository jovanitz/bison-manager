import type { AccessPermission, Role } from '@acme/domain';

/**
 * Merge permission groups into one flat, de-duplicated list (dedupe key is
 * `action:scope`, first occurrence wins, order preserved). The building block
 * for role expansion and actor resolution. Pure — deterministic, no deps.
 */
export const unionPermissions = (
  ...groups: ReadonlyArray<ReadonlyArray<AccessPermission>>
): ReadonlyArray<AccessPermission> => {
  const seen = new Set<string>();
  const out: AccessPermission[] = [];
  for (const group of groups) {
    for (const permission of group) {
      const key = `${permission.action}:${permission.scope}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(permission);
    }
  }
  return out;
};

/**
 * Expand a set of roles into the flat, de-duplicated permission list the policy
 * core consumes (ADR-0011). This is the whole point of roles: actor resolution
 * computes `union(expand(roleIds))` so the deny-by-default core never learns
 * roles exist.
 */
export const expandRoles = (
  roles: ReadonlyArray<Role>,
): ReadonlyArray<AccessPermission> =>
  unionPermissions(...roles.map((role) => role.permissions));

/**
 * A membership's effective permissions (ADR-0011, transitional): its direct
 * permissions unioned with everything its roles expand to. Direct permissions
 * stay the source of truth until the preset→role migration; roles add on top.
 */
export const resolveActorPermissions = (
  direct: ReadonlyArray<AccessPermission>,
  roles: ReadonlyArray<Role>,
): ReadonlyArray<AccessPermission> =>
  unionPermissions(direct, ...roles.map((role) => role.permissions));
