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
export * from './access/in-memory/seed/access-seed';
export * from './access/in-memory/access-store';
// Store-agnostic composition (works over in-memory or Postgres ports alike).
export * from './access/org-detail/access-org-detail-reader';

// Billing adapters (ADR-0016): in-memory reference (browser-safe), seeded
// from DEFAULT_PLANS, plus the store-agnostic usage composition. The
// Postgres billing store (./billing/postgres/*) is deliberately NOT exported
// here — same Node-only `postgres` driver rule as the access store above.
export * from './billing/in-memory/billing-store-state';
export * from './billing/in-memory/in-memory-plan-catalog-store';
export * from './billing/in-memory/in-memory-subscription-store';
export * from './billing/in-memory/in-memory-billing-store';
export * from './billing/usage/entitlement-usage-reader';
// Billing ledger (ADR-0018): in-memory reference. The Postgres ledger stores
// (./billing-ledger/postgres/*) are contract-tested but NOT exported yet —
// same Node-only driver rule as the billing store above.
export * from './billing-ledger/in-memory/in-memory-charge-store';
export * from './billing-ledger/in-memory/in-memory-payment-store';

// Auth adapters
export * from './auth/jwt-auth-provider';
export * from './auth/fake-auth-provider';
export * from './notifications/notification-senders';
export * from './auth/supabase-auth-provider';
export * from './auth/supabase-auth-api';
export * from './auth/provisioning/in-memory-identity-provisioner';
export * from './auth/provisioning/identity-purgers';

// Access client adapters (browser-safe: fetch/ApiClient only)
export * from './access-client/rpc-access-gateway';
export * from './access-client/gateways/rpc-directory-gateway';
export * from './access-client/gateways/rpc-invitations-gateway';
export * from './access-client/gateways/rpc-activation-gateway';
export * from './access-client/gateways/rpc-members-gateway';
export * from './access-client/gateways/rpc-block-gateway';
export * from './access-client/gateways/admin/rpc-account-admin-gateway';
export * from './access-client/gateways/admin/rpc-audit-gateway';
export * from './access-client/gateways/admin/rpc-sessions-gateway';
export * from './access-client/gateways/admin/rpc-settings-gateway';
export * from './access-client/gateways/admin/rpc-org-detail-gateway';
export * from './access-client/gateways/admin/rpc-billing-gateway';
export * from './access-client/gateways/admin/rpc-coverage-gateway';
export * from './access-client/gateways/rpc-roles-gateway';
export * from './access-client/gateways/client/rpc-orgs-gateway';

// Offline sync
export * from './sync/dexie-operation-queue';
export * from './sync/in-memory-operation-queue';
export * from './sync/offline-item-repository';
export * from './sync/sync-engine';

// NOTE: the reusable contract test (`./testing/item-repository-contract`) is
// intentionally NOT exported here — it imports `vitest`, which must never reach
// a production bundle. Specs import it directly via its relative path.
