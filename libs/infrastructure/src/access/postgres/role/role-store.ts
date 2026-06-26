import type { RoleStore } from '@acme/application';
import type { AccessPermission, AccountId, Role, RoleId } from '@acme/domain';
import type { Row, Sql } from 'postgres';
import { isUuid } from '../rows';

/**
 * Postgres {@link RoleStore} (ADR-0011) — same contract as the in-memory
 * adapter. Permissions live in a `jsonb` column (written via `sql.json`, read
 * back as the permission array); `list` returns platform roles (`account_id`
 * null) plus the account's own; `countAssignments` scans `memberships.role_ids`
 * for the delete-blocked-in-use guard. `syncTemplate` propagates a template
 * edit to its live instances (ADR-0014, eager model).
 */
const toRole = (row: Row): Role => ({
  id: row['id'] as RoleId,
  name: row['name'] as Role['name'],
  accountId: (row['account_id'] as AccountId | null) ?? null,
  permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
  // ADR-0012 provenance: the factory template this role derives from, or null.
  templateKey: (row['template_key'] as string | null) ?? null,
  // ADR-0014 eager-propagation flag (only meaningful with a template_key).
  templateSynced: (row['template_synced'] as boolean | null) ?? true,
  // ADR-0014 Phase 2: a one-membership personal role (the direct-perms slot).
  isPersonal: (row['is_personal'] as boolean | null) ?? false,
});

const roleReads = (
  sql: Sql,
): Pick<RoleStore, 'list' | 'findById' | 'findManyById'> => ({
  list: async (accountId: AccountId | null) => {
    // personal roles are an internal per-membership slot, never a listable org
    // role (ADR-0014 Phase 2): excluded from management + assignment.
    const rows =
      accountId !== null && isUuid(accountId)
        ? await sql`
            select id, account_id, name, permissions, template_key, template_synced, is_personal
            from public.roles
            where (account_id is null or account_id = ${accountId}) and not is_personal
            order by name asc
          `
        : await sql`
            select id, account_id, name, permissions, template_key, template_synced, is_personal
            from public.roles
            where account_id is null and not is_personal
            order by name asc
          `;
    return rows.map(toRole);
  },

  findById: async (roleId: RoleId) => {
    if (!isUuid(roleId)) return null;
    const rows = await sql`
      select id, account_id, name, permissions, template_key, template_synced, is_personal
      from public.roles where id = ${roleId} limit 1
    `;
    return rows[0] ? toRole(rows[0]) : null;
  },

  findManyById: async (roleIds: ReadonlyArray<RoleId>) => {
    const valid = roleIds.filter(isUuid);
    if (valid.length === 0) return [];
    const rows = await sql`
      select id, account_id, name, permissions, template_key, template_synced, is_personal
      from public.roles where id = any(${valid as unknown as string[]})
    `;
    return rows.map(toRole);
  },
});

const roleWrites = (
  sql: Sql,
): Omit<RoleStore, 'list' | 'findById' | 'findManyById'> => ({
  create: async (role: Role) => {
    await sql`
      insert into public.roles
        (id, account_id, name, permissions, template_key, template_synced, is_personal)
      values (${role.id}, ${role.accountId}, ${role.name},
        ${sql.json(role.permissions as never)}, ${role.templateKey},
        ${role.templateSynced}, ${role.isPersonal})
    `;
  },

  update: async (roleId, patch) => {
    if (!isUuid(roleId)) return false;
    // `coalesce(NULL, template_synced)` leaves the flag unchanged when the
    // patch omits it; a boolean forces it (fork on edit, re-sync on reset).
    const rows = await sql`
      update public.roles
      set name = ${patch.name},
          permissions = ${sql.json(patch.permissions as never)},
          template_synced = coalesce(${patch.templateSynced ?? null}, template_synced)
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

  syncTemplate: async (templateKey, patch, options) => {
    const rows = await sql`
      update public.roles
      set name = ${patch.name},
          permissions = ${sql.json(patch.permissions as never)},
          template_synced = true
      where template_key = ${templateKey}
        and (${options.includeForked} or template_synced = true)
      returning id
    `;
    return rows.length;
  },
});

export const createPostgresRoleStore = (sql: Sql): RoleStore => ({
  ...roleReads(sql),
  ...roleWrites(sql),
});
