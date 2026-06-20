import { type Result, err, ok } from '@acme/shared';
import { makeAccessPermission, makeAccountId } from '@acme/domain';
import type {
  AccessActor,
  AccessPermission,
  AccountId,
  AccountKind,
} from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { guardGrantedPermissions } from '../access-admin/deps';
import type { RoleUseCaseError } from './errors';

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
