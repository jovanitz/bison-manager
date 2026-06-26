import type { AccessPermission } from '@acme/domain';
import type { Row } from 'postgres';
import type { SqlLike } from '../rows';

/**
 * Upsert the membership's personal role with `permissions`, on `tx` (ADR-0014
 * roles-only): one-off grants live in a personal role so roles are the single
 * source of truth. Updates the role in place, or creates it and appends it to
 * `role_ids`. The caller wraps it in the audited transaction.
 */
export const upsertPersonalRole = async (
  tx: SqlLike,
  membership: {
    readonly id: string;
    readonly accountId: string;
    readonly roleIds: ReadonlyArray<string>;
  },
  permissions: ReadonlyArray<AccessPermission>,
): Promise<void> => {
  const existing = membership.roleIds.length
    ? await tx`
        select id from public.roles
        where id = any(${membership.roleIds}::uuid[]) and is_personal
        limit 1`
    : [];
  const personalId = existing[0]?.['id'] as string | undefined;
  if (personalId) {
    await tx`
      update public.roles set permissions = ${tx.json(permissions as never)}
      where id = ${personalId}`;
    return;
  }
  const id = crypto.randomUUID();
  await tx`
    insert into public.roles
      (id, account_id, name, permissions, template_key,
       template_synced, is_personal)
    values (${id}, ${membership.accountId}, 'Personal permissions',
      ${tx.json(permissions as never)}, null, true, true)`;
  await tx`
    update public.memberships
    set role_ids = array_append(role_ids, ${id}::uuid)
    where id = ${membership.id}`;
};

/**
 * One-off permissions from a row that selected the personal role's permissions
 * as `personal` (the lateral join used by findMembership / listMembers).
 * Excludes shared roles by construction; roles-only, so there is no direct list.
 */
export const oneOffFromRow = (row: Row): ReadonlyArray<AccessPermission> =>
  (row['personal'] as ReadonlyArray<AccessPermission>) ?? [];
