import postgres from 'postgres';
import type { Sql } from 'postgres';
import { SEED_SESSION_CREATED_AT } from '../access/in-memory/seed/access-seed';
import type { InMemoryAccessSeed } from '../access/in-memory/seed/access-seed';

/**
 * Test/dev plumbing: load an `InMemoryAccessSeed` into the Postgres schema so
 * both stores can run the same contract suite. WIPES the access tables (and
 * auth.users) first — local/test databases only, never production.
 *
 * Mapping notes: seed `customers` become accounts with kind='customer';
 * remaining `accounts` are kind='staff'. Membership user ids are created in
 * auth.users (locally GoTrue tolerates direct inserts).
 */
const wipe = async (sql: Sql): Promise<void> => {
  await sql`
    truncate public.audit_events, public.access_grants, public.sessions,
      public.memberships, public.roles, public.role_templates,
      public.accounts, public.access_settings
      restart identity cascade
  `;
  await sql`delete from auth.users`;
};

type AccountRow = {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly kind: 'customer' | 'staff';
  readonly status: string;
  readonly createdAt: string;
};

const toAccountRows = (seed: InMemoryAccessSeed): AccountRow[] => {
  const accounts = seed.accounts ?? [];
  const customers = seed.customers ?? [];
  const customerIds = new Set(customers.map((c) => c.accountId));
  const staff = accounts
    .filter((a) => !customerIds.has(a.id))
    .map((a) => ({
      id: a.id,
      displayName: 'Staff account',
      email: null,
      kind: 'staff' as const,
      status: a.status ?? 'active',
      createdAt: new Date().toISOString(),
    }));
  const customerRows = customers.map((c) => ({
    id: c.accountId,
    displayName: c.displayName,
    email: c.email ?? null,
    kind: 'customer' as const,
    status:
      c.status ??
      accounts.find((a) => a.id === c.accountId)?.status ??
      'active',
    createdAt: c.createdAt ?? new Date().toISOString(),
  }));
  return [...staff, ...customerRows];
};

const insertAccounts = async (
  sql: Sql,
  seed: InMemoryAccessSeed,
): Promise<void> => {
  for (const row of toAccountRows(seed)) {
    await sql`
      insert into public.accounts (id, display_name, email, kind, status, created_at)
      values (${row.id}, ${row.displayName}, ${row.email}, ${row.kind},
        ${row.status}, ${row.createdAt})
    `;
  }
};

const seedUserIds = (seed: InMemoryAccessSeed): ReadonlyArray<string> => [
  ...new Set([
    ...(seed.memberships ?? []).map((m) => m.userId),
    ...(seed.users ?? []).map((u) => u.id),
  ]),
];

const insertRoles = async (
  sql: Sql,
  seed: InMemoryAccessSeed,
): Promise<void> => {
  for (const role of seed.roles ?? []) {
    await sql`
      insert into public.roles
        (id, account_id, name, permissions, template_key, template_synced,
         is_personal)
      values (${role.id}, ${role.accountId}, ${role.name},
        ${sql.json(role.permissions as never)}, ${role.templateKey},
        ${role.templateSynced}, ${role.isPersonal})
    `;
  }
  for (const t of seed.roleTemplates ?? []) {
    await sql`
      insert into public.role_templates (key, scope, name, permissions)
      values (${t.key}, ${t.scope}, ${t.name},
        ${sql.json(t.permissions as never)})
    `;
  }
};

const insertMemberships = async (
  sql: Sql,
  seed: InMemoryAccessSeed,
): Promise<void> => {
  for (const m of seed.memberships ?? []) {
    // roles-only (ADR-0014 Phase 2.D): a membership's one-off permissions are
    // seeded as a personal role, never the direct slot — mirroring the data
    // migration so the contract runs against roles-only data.
    const roleIds = [...(m.roleIds ?? [])];
    if (m.permissions.length > 0) {
      const personalId = crypto.randomUUID();
      await sql`
        insert into public.roles
          (id, account_id, name, permissions, template_key, template_synced,
           is_personal)
        values (${personalId}, ${m.accountId}, 'Personal permissions',
          ${sql.json(m.permissions as never)}, null, true, true)
      `;
      roleIds.push(personalId);
    }
    await sql`
      insert into public.memberships
        (id, user_id, account_id, role_ids, is_account_owner)
      values (${m.id}, ${m.userId}, ${m.accountId},
        ${roleIds as unknown as string[]}::uuid[],
        ${m.isAccountOwner ?? false})
    `;
  }
};

const insertPeople = async (
  sql: Sql,
  seed: InMemoryAccessSeed,
): Promise<void> => {
  for (const userId of seedUserIds(seed)) {
    await sql`
      insert into auth.users (id, instance_id, aud, role)
      values (${userId}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
      on conflict (id) do nothing
    `;
  }
  await insertMemberships(sql, seed);
  for (const raw of seed.sessions ?? []) {
    const row = {
      status: raw.status ?? 'active',
      createdAt: raw.createdAt ?? SEED_SESSION_CREATED_AT,
    };
    await sql`
      insert into public.sessions
        (id, membership_id, status, expires_at, created_at, last_seen_at)
      values (${raw.id}, ${raw.membershipId}, ${row.status},
        ${raw.expiresAt}, ${row.createdAt}, ${row.createdAt})
    `;
  }
  for (const g of seed.grants ?? []) {
    await sql`
      insert into public.access_grants
        (id, kind, membership_id, target_account_id, actions, reason,
         created_at, expires_at, revoked_at, expiry_recorded_at)
      values (${g.id}, ${g.kind}, ${g.membershipId}, ${g.targetAccountId},
        ${sql.json(g.actions as never)}, ${g.reason}, ${g.createdAt},
        ${g.expiresAt}, ${g.revokedAt}, ${g.expiryRecordedAt})
    `;
  }
};

export const applyPostgresAccessSeed = async (
  databaseUrl: string,
  seed: InMemoryAccessSeed,
): Promise<void> => {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
  try {
    await wipe(sql);
    await insertAccounts(sql, seed);
    await insertRoles(sql, seed);
    await insertPeople(sql, seed);
  } finally {
    await sql.end();
  }
};
