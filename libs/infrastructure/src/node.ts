/**
 * Node-only entry point (`@acme/infrastructure-node`).
 *
 * The Postgres/Supabase adapters import the `postgres` driver, which depends
 * on Node built-ins and must never reach the browser bundles — that is why
 * they are excluded from the main barrel (see index.ts). Only Node-side
 * composition roots (apps/api) may import this module.
 */
export * from './access/postgres/postgres-access-store';
