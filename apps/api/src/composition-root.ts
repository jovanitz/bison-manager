import { systemClock, uuidGenerator } from '@acme/shared';
import type { Clock, IdGenerator } from '@acme/shared';
import {
  makeAccessAdminUseCases,
  makeAccessUseCases,
  makeAuditTrailUseCases,
  makeIdentityUseCases,
  makeImpersonationUseCases,
} from '@acme/application';
import { createInMemoryAccessStore } from '@acme/infrastructure';
import type { InMemoryAccessSeed } from '@acme/infrastructure';
import { createPostgresAccessStore } from '@acme/infrastructure-node';
import { createApi } from './app';
import { createSupabaseTokenVerifier } from './identity/token-verifier';
import { createApiProcedures } from './procedures';
import type { ApiIdentityPipeline } from './rpc/actor-middleware';
import type { ApiProcedure } from './rpc/procedure';

/**
 * The API composition root — the only place concrete adapters are chosen.
 * Two axes, both decided here and nowhere else:
 * - store: Postgres/Supabase when `databaseUrl` is set, else in-memory + seed.
 * - identity: Supabase JWT verification + session onboarding when `jwtSecret`
 *   is set, else the dev/test stub (bearer token = session id).
 */
export type ApiRuntime = {
  readonly app: ReturnType<typeof createApi>;
  /** The declared surface — what the future MCP tool registry will publish. */
  readonly procedures: ReadonlyArray<ApiProcedure>;
  readonly close: () => Promise<void>;
};

export type ApiConfig = {
  readonly seed?: InMemoryAccessSeed;
  readonly databaseUrl?: string;
  /** Modern Supabase: JWKS endpoint (asymmetric signing keys). */
  readonly jwksUrl?: string;
  /** Legacy/tests: shared HS256 JWT secret. */
  readonly jwtSecret?: string;
  /** ADR-0010 owner bootstrap — comes from BOOTSTRAP_OWNER_EMAIL, only here. */
  readonly bootstrapOwnerEmail?: string | null;
  /** Browser origins allowed on /rpc (bearer auth, no cookies → no CSRF). */
  readonly corsOrigins?: ReadonlyArray<string>;
  /** Dev-only test console at GET /dev (never wire in production). */
  readonly devConsole?: () => string;
  readonly sessionTtlMs?: number;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
};

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const toVerifierConfig = (
  config: ApiConfig,
): Parameters<typeof createSupabaseTokenVerifier>[0] | null => {
  if (config.jwksUrl) return { jwksUrl: config.jwksUrl };
  if (config.jwtSecret) return { jwtSecret: config.jwtSecret };
  return null;
};

/** Optional createApi deps (exactOptionalPropertyTypes: omit, never undefined). */
const toApiOptions = (
  config: ApiConfig,
  identity: ApiIdentityPipeline | undefined,
) => ({
  ...(identity ? { identity } : {}),
  ...(config.corsOrigins ? { corsOrigins: config.corsOrigins } : {}),
  ...(config.devConsole ? { devConsole: config.devConsole } : {}),
});

export const createApiRuntime = (config: ApiConfig): ApiRuntime => {
  const clock = config.clock ?? systemClock;
  const ids = config.ids ?? uuidGenerator;
  const store = config.databaseUrl
    ? createPostgresAccessStore({ databaseUrl: config.databaseUrl })
    : { ...createInMemoryAccessStore(config.seed ?? {}), close: undefined };

  const access = makeAccessUseCases({
    actors: store.actors,
    grantExpiry: store.grantExpiry,
    clock,
  });
  const auditTrail = makeAuditTrailUseCases({ trail: store.auditTrail, clock });
  const accessAdmin = makeAccessAdminUseCases({ admin: store.admin, clock });
  const impersonation = makeImpersonationUseCases({
    grants: store.grants,
    customers: store.customers,
    clock,
    ids,
  });

  const verifierConfig = toVerifierConfig(config);
  const identity: ApiIdentityPipeline | undefined = verifierConfig
    ? {
        verifier: createSupabaseTokenVerifier(verifierConfig),
        registerSession: makeIdentityUseCases({
          onboarding: store.onboarding,
          clock,
          ids,
          bootstrapOwnerEmail: config.bootstrapOwnerEmail ?? null,
        }).registerIdentitySession,
        sessionTtlMs: config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS,
        clock,
      }
    : undefined;

  const procedures = createApiProcedures({
    access,
    auditTrail,
    accessAdmin,
    impersonation,
  });
  const app = createApi({
    procedures,
    resolveActor: access.resolveRequestActor,
    ...toApiOptions(config, identity),
  });
  return {
    app,
    procedures,
    close: async () => {
      await store.close?.();
    },
  };
};
