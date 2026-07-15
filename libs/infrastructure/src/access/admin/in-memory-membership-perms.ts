import { resolveActorPermissions } from '@acme/application';
import { createRole } from '@acme/domain';
import type {
  AccessMemberRolesAssigned,
  AccessPermission,
  AccountId,
  RoleId,
} from '@acme/domain';
import { appendInMemoryAuditRecord } from '../in-memory/audit-trail';
import type {
  AccessStoreState,
  StoredMembership,
} from '../in-memory/seed/access-seed';

/**
 * Effective permissions of a stored membership: its direct list unioned with
 * everything its assigned roles expand to (ADR-0014 roles-only). The anti-orphan
 * count reads this, so a role-granted admin governs just like a direct one.
 */
const effectivePermissions = (
  state: AccessStoreState,
  membership: { readonly roleIds: ReadonlyArray<string> },
): ReadonlyArray<AccessPermission> => {
  const roles = membership.roleIds.flatMap((id) => {
    const role = state.roles.get(id);
    return role ? [role] : [];
  });
  return resolveActorPermissions(roles);
};

/** Is there an administrator (permissions.update holder) of the account other
 * than `exceptId`? Anchors the anti-orphan invariant (ADR-0011/0014). */
export const hasOtherAdmin = (
  state: AccessStoreState,
  accountId: string,
  exceptId: string,
): boolean =>
  [...state.memberships].some(
    ([id, m]) =>
      id !== exceptId &&
      m.accountId === accountId &&
      effectivePermissions(state, m).some(
        (p) => p.action === 'permissions.update',
      ),
  );

/**
 * Would removing `membershipId` leave its account with no administrator? True
 * ONLY if the target is currently an admin (effective) and no OTHER membership
 * is — removing a non-admin (or when a co-admin remains) never orphans.
 */
export const removeWouldOrphan = (
  state: AccessStoreState,
  membershipId: string,
): boolean => {
  const m = state.memberships.get(membershipId);
  if (!m) return false;
  const wasAdmin = effectivePermissions(state, m).some(
    (p) => p.action === 'permissions.update',
  );
  return wasAdmin && !hasOtherAdmin(state, m.accountId, membershipId);
};

/**
 * One-off permissions of a membership: its personal role's permissions
 * (ADR-0014 roles-only — there is no direct slot). This is the editable set the
 * "manage permissions" surface shows; shared roles are managed separately.
 */
export const oneOffPermissions = (
  state: AccessStoreState,
  membership: StoredMembership,
): ReadonlyArray<AccessPermission> => {
  const personal = membership.roleIds
    .map((id) => state.roles.get(id))
    .find((role) => role?.isPersonal);
  return personal?.permissions ?? [];
};

/** The membership's personal-role id, if it owns one. */
export const personalRoleId = (
  state: AccessStoreState,
  membership: StoredMembership,
): string | undefined =>
  membership.roleIds.find((id) => state.roles.get(id)?.isPersonal);

/**
 * Upsert the membership's personal role with `permissions` (ADR-0014 roles-only):
 * one-off grants live in a personal role so roles are the single source of
 * truth. Updates the role in place, or creates it and adds it to `roleIds`.
 */
export const upsertPersonalRole = (
  state: AccessStoreState,
  membershipId: string,
  membership: StoredMembership,
  permissions: ReadonlyArray<AccessPermission>,
): void => {
  const existingId = personalRoleId(state, membership);
  if (existingId) {
    const role = state.roles.get(existingId);
    if (role) state.roles.set(existingId, { ...role, permissions });
    return;
  }
  const created = createRole({
    id: crypto.randomUUID() as RoleId,
    name: 'Personal permissions',
    accountId: membership.accountId as AccountId,
    permissions,
    isPersonal: true,
  });
  if (!created.ok) return;
  state.roles.set(created.value.id, created.value);
  state.memberships.set(membershipId, {
    ...membership,
    roleIds: [...membership.roleIds, created.value.id],
  });
};

/**
 * Replace a membership's shared-role assignment while preserving its personal
 * role — the one-off slot, never listed/assignable, so a role-assignment edit
 * must keep it (ADR-0014 Phase 2) — and record the audit event.
 */
export const assignMembershipRoles = (
  state: AccessStoreState,
  membershipId: string,
  roleIds: ReadonlyArray<RoleId>,
  event: AccessMemberRolesAssigned,
): { readonly orphaned: boolean } => {
  const membership = state.memberships.get(membershipId);
  if (!membership) return { orphaned: false };
  const personal = personalRoleId(state, membership);
  const next =
    personal && !roleIds.includes(personal as RoleId)
      ? [...roleIds, personal]
      : [...roleIds];
  // anti-orphan: refuse only if the target is the account's sole admin and the
  // new roles drop the governing capability (ADR-0014).
  const isGov = (p: AccessPermission) => p.action === 'permissions.update';
  const wasAdmin = effectivePermissions(state, membership).some(isGov);
  const willBeAdmin = effectivePermissions(state, { roleIds: next }).some(
    isGov,
  );
  if (
    wasAdmin &&
    !willBeAdmin &&
    !hasOtherAdmin(state, membership.accountId, membershipId)
  ) {
    return { orphaned: true };
  }
  state.memberships.set(membershipId, { ...membership, roleIds: next });
  appendInMemoryAuditRecord(state, event);
  return { orphaned: false };
};
