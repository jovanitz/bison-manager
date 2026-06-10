// Persistence adapters
export * from './persistence/in-memory-item-repository';
export * from './persistence/dexie-db';
export * from './persistence/dexie-item-repository';

// API adapters
export * from './api/http-api-client';
export * from './api/api-item-repository';

// Access adapters (in-memory until the Supabase adapters land in phase 4)
export * from './access/in-memory-access-seed';
export * from './access/in-memory-access-store';

// Auth adapters
export * from './auth/jwt-auth-provider';
export * from './auth/fake-auth-provider';

// Offline sync
export * from './sync/dexie-operation-queue';
export * from './sync/in-memory-operation-queue';
export * from './sync/offline-item-repository';
export * from './sync/sync-engine';

// NOTE: the reusable contract test (`./testing/item-repository-contract`) is
// intentionally NOT exported here — it imports `vitest`, which must never reach
// a production bundle. Specs import it directly via its relative path.
