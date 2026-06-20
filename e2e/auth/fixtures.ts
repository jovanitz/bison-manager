/**
 * Shared constants for the auth (front↔back) e2e. All values target the LOCAL
 * Supabase stack and are public, well-known dev values — never secrets (the
 * local anon key is the same one apps/web/src/main.tsx defaults to). The service
 * key is deliberately NOT here: sign-in needs only the anon key.
 */
export const SUPABASE_URL = 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY =
  'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

/**
 * Matches BOOTSTRAP_OWNER_EMAIL in apps/api/.env.development, so the first
 * sign-in bootstraps this user as the org owner (ADR-0010) — no manual
 * membership/session seeding needed.
 */
export const OWNER_EMAIL = 'owner@local.dev';
export const OWNER_PASSWORD = 'Password123!';
