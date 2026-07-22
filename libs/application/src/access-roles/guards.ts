import { type Result, err, ok } from '@acme/shared';
import { makeAccessPermission, makeAccountId } from '@acme/domain';
import type {
  AccessActor,
  AccessPermission,
  AccountId,
  AccountKind,
  RoleId,
} from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { guardGrantedPermissions } from '../access-admin/deps';
import type { AccessAdminUseCaseError } from '../access-admin/errors';
import type { RoleStore } from './ports';
import type { RoleUseCaseError } from './errors';

/** Why a role-set failed the attachment law: unreachable (missing/foreign), or
 *  carrying permissions the account's kind may not hold. */
export type RolesForAccountIssue =
  | { readonly kind: 'invalid' }
  | { readonly kind: 'incoherent'; readonly error: AccessAdminUseCaseError };

/**
 * THE single coherence law for attaching platform/own roles to an account
 * (ADR-0011). Every role must (1) exist, (2) be reachable by the account —
 * platform-wide (`accountId: null`) or the account's OWN, never a foreign org's,
 * and (3) carry only permissions coherent with the account's kind. Both the
 * invitation path AND direct assignment MUST route through here, so the law
 * cannot drift between them: without (3), a customer-org admin could attach a
 * seeded platform role (Support) and smuggle staff-grade `any`-scoped powers
 * (impersonation, cross-org reads) INTO a customer account — the escalation the
 * audit found. Callers map the issue to their own error surface.
 */
export const guardRolesForAccount = async (
  roles: Pick<RoleStore, 'findManyById'>,
  accountId: AccountId,
  accountKind: AccountKind,
  roleIds: ReadonlyArray<RoleId>,
): Promise<Result<void, RolesForAccountIssue>> => {
  if (roleIds.length === 0) return ok(undefined);
  const found = await roles.findManyById(roleIds);
  if (found.length !== roleIds.length) return err({ kind: 'invalid' });
  const foreign = found.some(
    (role) => role.accountId !== null && role.accountId !== accountId,
  );
  if (foreign) return err({ kind: 'invalid' });
  for (const role of found) {
    const coherent = guardGrantedPermissions(role.permissions, accountKind);
    if (!coherent.ok) return err({ kind: 'incoherent', error: coherent.error });
  }
  return ok(undefined);
};

export type RawPermission = { readonly action: string; readonly scope: string };

// Managing roles is "deciding who-can-do-what" — gated by the same action as
// editing permissions. Root/owner bypass (ADR-0011) covers themselves.
export const ROLE_ACTION = 'permissions.update' as const;

// A platform role (no account) is staff-grade; an account-scoped role is for a
// customer org, so it must obey the customer coherence rules (no `any`).
export const kindOf = (accountId: AccountId | null): AccountKind =>
  accountId === null ? 'staff' : 'customer';

export const parseAccountId = (
  raw: string | null,
): Result<AccountId | null, RoleUseCaseError> => {
  if (raw === null) return ok(null);
  const parsed = makeAccountId(raw);
  return parsed.ok ? ok(parsed.value) : err(parsed.error);
};

export const parsePermissions = (
  raw: ReadonlyArray<RawPermission>,
): Result<ReadonlyArray<AccessPermission>, RoleUseCaseError> => {
  const out: AccessPermission[] = [];
  for (const entry of raw) {
    const permission = makeAccessPermission(entry);
    if (!permission.ok) return err(permission.error);
    out.push(permission.value);
  }
  return ok(out);
};

/** Coherent, authorized permission set for a role on the given account. */
export const guardRolePermissions = (
  actor: AccessActor,
  accountId: AccountId | null,
  raw: ReadonlyArray<RawPermission>,
  now: string,
): Result<ReadonlyArray<AccessPermission>, RoleUseCaseError> => {
  const authorized = authorizeAccessAction({
    actor,
    action: ROLE_ACTION,
    resource: { accountId },
    now,
  });
  if (!authorized.ok) return err(authorized.error);
  const permissions = parsePermissions(raw);
  if (!permissions.ok) return permissions;
  const coherent = guardGrantedPermissions(
    permissions.value,
    kindOf(accountId),
  );
  return coherent.ok ? ok(permissions.value) : err(coherent.error);
};
