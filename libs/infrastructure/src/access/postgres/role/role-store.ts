import type { RoleStore } from '@acme/application';
import type { AccessPermission, AccountId, Role, RoleId } from '@acme/domain';
import type { Row, Sql } from 'postgres';
import { isUuid } from '../rows';

/**
 * Postgres {@link RoleStore} (ADR-0011) — same contract as the in-memory
 * adapter. Permissions live in a `jsonb` column (written via `sql.json`, read
 * back as the permission array); `list` returns platform roles (`account_id`
 * null) plus the account's own; `countAssignments` scans `memberships.role_ids`
 * for the delete-blocked-in-use guard.
 */
const toRole = (row: Row): Role => ({
  id: row['id'] as RoleId,
  name: row['name'] as Role['name'],
  accountId: (row['account_id'] as AccountId | null) ?? null,
  permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
});

export const createPostgresRoleStore = (sql: Sql): RoleStore => ({
  create: async (role: Role) => {
    await sql`
      insert into public.roles (id, account_id, name, permissions)
      values (${role.id}, ${role.accountId}, ${role.name},
        ${sql.json(role.permissions as never)})
    `;
  },

  list: async (accountId: AccountId | null) => {
    const rows =
      accountId !== null && isUuid(accountId)
        ? await sql`
            select id, account_id, name, permissions
            from public.roles
            where account_id is null or account_id = ${accountId}
            order by name asc
          `
        : await sql`
            select id, account_id, name, permissions
            from public.roles
            where account_id is null
            order by name asc
          `;
    return rows.map(toRole);
  },

  findById: async (roleId: RoleId) => {
    if (!isUuid(roleId)) return null;
    const rows = await sql`
      select id, account_id, name, permissions
      from public.roles where id = ${roleId} limit 1
    `;
    return rows[0] ? toRole(rows[0]) : null;
  },

  findManyById: async (roleIds: ReadonlyArray<RoleId>) => {
    const valid = roleIds.filter(isUuid);
    if (valid.length === 0) return [];
    const rows = await sql`
      select id, account_id, name, permissions
      from public.roles where id = any(${valid as unknown as string[]})
    `;
    return rows.map(toRole);
  },

  update: async (roleId, patch) => {
    if (!isUuid(roleId)) return false;
    const rows = await sql`
      update public.roles
      set name = ${patch.name},
          permissions = ${sql.json(patch.permissions as never)}
      where id = ${roleId}
      returning id
    `;
    return rows.length > 0;
  },

  remove: async (roleId: RoleId) => {
    if (!isUuid(roleId)) return;
    await sql`delete from public.roles where id = ${roleId}`;
  },

  countAssignments: async (roleId: RoleId) => {
    if (!isUuid(roleId)) return 0;
    const rows = await sql`
      select count(*)::int as n
      from public.memberships
      where ${roleId} = any(role_ids)
    `;
    return (rows[0]?.['n'] as number) ?? 0;
  },
});
