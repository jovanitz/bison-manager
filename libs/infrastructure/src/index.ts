// Persistence adapters
export * from './persistence/in-memory-item-repository';
export * from './persistence/dexie-db';
export * from './persistence/dexie-item-repository';

// API adapters
export * from './api/http-api-client';
export * from './api/api-item-repository';

// Access adapters: in-memory reference (browser-safe). The Postgres/Supabase
// store (./access/postgres/*) is deliberately NOT exported here — it imports
// the Node-only `postgres` driver, which breaks the web/mobile/desktop
// bundles. The Node-side API composition root gets it via a dedicated entry
// point (wired in phase 4c); specs import it relatively.
export * from './access/in-memory-access-seed';
export * from './access/in-memory-access-store';

// Auth adapters
export * from './auth/jwt-auth-provider';
export * from './auth/fake-auth-provider';
export * from './auth/supabase-auth-provider';
export * from './auth/supabase-auth-api';

// Access client adapters (browser-safe: fetch/ApiClient only)
export * from './access-client/rpc-access-gateway';

// Offline sync
export * from './sync/dexie-operation-queue';
export * from './sync/in-memory-operation-queue';
export * from './sync/offline-item-repository';
export * from './sync/sync-engine';

// NOTE: the reusable contract test (`./testing/item-repository-contract`) is
// intentionally NOT exported here — it imports `vitest`, which must never reach
// a production bundle. Specs import it directly via its relative path.
