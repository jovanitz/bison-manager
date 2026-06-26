import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { productionBootErrors } from './boot-safety';
import { createApiRuntime } from './composition-root';
import { seedWorld } from './seed';

// Env files (Node-native, no deps). Real environment variables always win;
// files only fill gaps. `.env` (gitignored, personal overrides) loads before
// `.env.development` (checked in, local-stack public defaults).
const envDir = path.resolve(import.meta.dirname, '..');
for (const file of ['.env', '.env.development']) {
  const candidate = path.join(envDir, file);
  if (existsSync(candidate)) process.loadEnvFile(candidate);
}

/**
 * Env contract (validated here, consumed only by the composition root):
 * - SUPABASE_DB_URL       → Postgres store (omit = in-memory dev seed).
 * - SUPABASE_URL          → real JWT identity via the project's JWKS
 *                           (modern asymmetric signing keys).
 * - SUPABASE_JWT_SECRET   → real JWT identity via legacy HS256 secret.
 *   (omit both = dev stub: `Authorization: Bearer session-<preset>`).
 * - BOOTSTRAP_OWNER_EMAIL → ADR-0010 one-time owner bootstrap.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  SUPABASE_DB_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().min(16).optional(),
  /** Supabase SECRET key — admin provisioning for invitation activation. */
  SUPABASE_SECRET_KEY: z.string().min(8).optional(),
  BOOTSTRAP_OWNER_EMAIL: z.string().email().optional(),
  /** Comma-separated browser origins for /rpc; defaults to the Vite dev ports. */
  CORS_ORIGINS: z.string().optional(),
  /** 'true' serves the static test console at GET /dev (local only). */
  DEV_CONSOLE: z.string().optional(),
  /** standard-webhooks secret of the GoTrue password-verification hook. */
  AUTH_HOOK_SECRET: z.string().min(8).optional(),
});

const DEV_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error('Invalid environment:', env.error.flatten().fieldErrors);
  process.exit(1);
}

const databaseUrl = env.data.SUPABASE_DB_URL;
const usePostgres = databaseUrl !== undefined;
const jwksUrl = env.data.SUPABASE_URL
  ? `${env.data.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  : undefined;
const identityModeOf = (): string => {
  if (jwksUrl) return 'supabase jwks';
  if (env.data.SUPABASE_JWT_SECRET) return 'supabase jwt secret';
  return 'dev stub';
};
const identityMode = identityModeOf();

// Fail-closed: in production, a missing env var must abort the boot rather
// than silently degrade to an insecure default.
const bootErrors = productionBootErrors({
  nodeEnv: process.env['NODE_ENV'],
  hasJwks: jwksUrl !== undefined,
  hasJwtSecret: env.data.SUPABASE_JWT_SECRET !== undefined,
  hasDatabaseUrl: usePostgres,
  hasAuthHookSecret: env.data.AUTH_HOOK_SECRET !== undefined,
  devConsole: env.data.DEV_CONSOLE === 'true',
});
if (bootErrors.length > 0) {
  console.error('Refusing to start (production safety):');
  for (const error of bootErrors) console.error(`  - ${error}`);
  process.exit(1);
}

const runtime = createApiRuntime({
  ...(databaseUrl !== undefined
    ? { databaseUrl }
    : {
        seed: seedWorld({
          sessionExpiresAt: new Date(
            Date.now() + DEV_SESSION_TTL_MS,
          ).toISOString(),
        }),
      }),
  ...(jwksUrl ? { jwksUrl } : {}),
  ...(env.data.SUPABASE_JWT_SECRET
    ? { jwtSecret: env.data.SUPABASE_JWT_SECRET }
    : {}),
  ...(env.data.SUPABASE_URL ? { supabaseUrl: env.data.SUPABASE_URL } : {}),
  ...(env.data.SUPABASE_SECRET_KEY
    ? { supabaseSecretKey: env.data.SUPABASE_SECRET_KEY }
    : {}),
  bootstrapOwnerEmail: env.data.BOOTSTRAP_OWNER_EMAIL ?? null,
  ...(env.data.AUTH_HOOK_SECRET
    ? { authHookSecret: env.data.AUTH_HOOK_SECRET }
    : {}),
  corsOrigins: env.data.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ],
  // Read per request: edit console.html without restarting. Dev-only.
  ...(env.data.DEV_CONSOLE === 'true'
    ? {
        devConsole: () =>
          readFileSync(
            path.join(import.meta.dirname, 'dev/console.html'),
            'utf8',
          ),
      }
    : {}),
});

// Instantiate the platform default roles before serving (idempotent).
const seeded = await runtime.seedPlatformDefaults();

serve({ fetch: runtime.app.fetch, port: env.data.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
  if (seeded.created > 0) {
    console.log(`seeded ${seeded.created} platform default role(s)`);
  }
  console.log(
    `store: ${usePostgres ? 'postgres (supabase)' : 'in-memory seed'} · identity: ${identityMode}`,
  );
  console.log(
    `procedures: ${runtime.procedures.map((p) => p.name).join(', ')}`,
  );
});
