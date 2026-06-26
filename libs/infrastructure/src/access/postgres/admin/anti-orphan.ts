import { unionPermissions } from '@acme/application';
import type { AccessPermission } from '@acme/domain';
import type { Row } from 'postgres';
import type { SqlLike } from '../rows';

const GOVERNING_ACTION = 'permissions.update';

/** Permissions of the given role ids, keyed by id (one query). */
const loadRolePerms = async (
  tx: SqlLike,
  roleIds: ReadonlyArray<string>,
): Promise<Map<string, ReadonlyArray<AccessPermission>>> => {
  const map = new Map<string, ReadonlyArray<AccessPermission>>();
  const ids = [...new Set(roleIds)];
  if (ids.length === 0) return map;
  const roles = await tx`
    select id, permissions from public.roles where id = any(${ids}::uuid[])
  `;
  for (const r of roles) {
    map.set(
      r['id'] as string,
      r['permissions'] as ReadonlyArray<AccessPermission>,
    );
  }
  return map;
};

const roleIdsOf = (m: Row): ReadonlyArray<string> =>
  (m['role_ids'] as string[] | null) ?? [];

/** Does `expand(roleIds)` hold the governing capability? (ADR-0014 roles-only) */
const holdsAdmin = (
  roleIds: ReadonlyArray<string>,
  rolePerms: Map<string, ReadonlyArray<AccessPermission>>,
): boolean =>
  unionPermissions(...roleIds.map((rid) => rolePerms.get(rid) ?? [])).some(
    (p) => p.action === GOVERNING_ACTION,
  );

const lockAccountMembers = async (
  tx: SqlLike,
  membershipId: string,
): Promise<{ accountId: string | undefined; members: ReadonlyArray<Row> }> => {
  const owner = await tx`
    select account_id from public.memberships where id = ${membershipId}
  `;
  const accountId = owner[0]?.['account_id'] as string | undefined;
  if (!accountId) return { accountId: undefined, members: [] };
  const members = await tx`
    select id, role_ids from public.memberships
    where account_id = ${accountId}
    for update
  `;
  return { accountId, members };
};

/**
 * Within a transaction: locks every membership of the account that owns
 * `membershipId` (`for update`) and reports whether one OTHER than it holds the
 * governing capability — read from `expand(roleIds)` (ADR-0014 roles-only), so a
 * role-granted admin counts. Anchors removal/demotion.
 */
export const hasOtherAdminLocked = async (
  tx: SqlLike,
  membershipId: string,
): Promise<boolean> => {
  const { accountId, members } = await lockAccountMembers(tx, membershipId);
  if (!accountId) return true; // no row to orphan
  const rolePerms = await loadRolePerms(tx, members.flatMap(roleIdsOf));
  return members.some(
    (m) => m['id'] !== membershipId && holdsAdmin(roleIdsOf(m), rolePerms),
  );
};

/**
 * Within a transaction: would setting `membershipId`'s roles to `nextRoleIds`
 * leave the account with no administrator? True ONLY if the target is currently
 * the sole admin and the new roles drop the governing capability — so a
 * reassignment that keeps (or never had) another admin is allowed (ADR-0014).
 */
export const assignWouldOrphanLocked = async (
  tx: SqlLike,
  membershipId: string,
  nextRoleIds: ReadonlyArray<string>,
): Promise<boolean> => {
  const { accountId, members } = await lockAccountMembers(tx, membershipId);
  if (!accountId) return false;
  const target = members.find((m) => m['id'] === membershipId);
  if (!target) return false;
  const rolePerms = await loadRolePerms(tx, [
    ...members.flatMap(roleIdsOf),
    ...nextRoleIds,
  ]);
  const otherAdmin = members.some(
    (m) => m['id'] !== membershipId && holdsAdmin(roleIdsOf(m), rolePerms),
  );
  if (otherAdmin) return false;
  const wasAdmin = holdsAdmin(roleIdsOf(target), rolePerms);
  const willBeAdmin = holdsAdmin(nextRoleIds, rolePerms);
  return wasAdmin && !willBeAdmin;
};

/**
 * Would removing `membershipId` leave its account with no administrator? The
 * role-set→∅ case of {@link assignWouldOrphanLocked}: true only if the target is
 * the sole admin (removing a non-admin, or with a co-admin, never orphans).
 */
export const removeWouldOrphanLocked = (
  tx: SqlLike,
  membershipId: string,
): Promise<boolean> => assignWouldOrphanLocked(tx, membershipId, []);
