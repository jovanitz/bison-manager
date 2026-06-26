import type { RoleTemplateStore } from '@acme/application';
import type { AccessPermission, RoleTemplate } from '@acme/domain';
import type { Row, Sql } from 'postgres';

/**
 * Postgres {@link RoleTemplateStore} (ADR-0013/0014) — same contract as the
 * in-memory adapter. Rows are staff *overrides* of the code catalogue; `upsert`
 * is insert-or-replace on the template key (a save, or a reset-to-code). The
 * use case merges these over `ROLE_TEMPLATES`, so an absent key is pristine.
 */
const toTemplate = (row: Row): RoleTemplate => ({
  key: row['key'] as string,
  scope: row['scope'] as RoleTemplate['scope'],
  name: row['name'] as string,
  permissions: row['permissions'] as ReadonlyArray<AccessPermission>,
});

export const createPostgresRoleTemplateStore = (
  sql: Sql,
): RoleTemplateStore => ({
  list: async () => {
    const rows = await sql`
      select key, scope, name, permissions
      from public.role_templates order by key asc
    `;
    return rows.map(toTemplate);
  },

  findByKey: async (key: string) => {
    const rows = await sql`
      select key, scope, name, permissions
      from public.role_templates where key = ${key} limit 1
    `;
    return rows[0] ? toTemplate(rows[0]) : null;
  },

  upsert: async (template: RoleTemplate) => {
    await sql`
      insert into public.role_templates (key, scope, name, permissions, updated_at)
      values (${template.key}, ${template.scope}, ${template.name},
        ${sql.json(template.permissions as never)}, now())
      on conflict (key) do update set
        scope = excluded.scope,
        name = excluded.name,
        permissions = excluded.permissions,
        updated_at = now()
    `;
  },
});
