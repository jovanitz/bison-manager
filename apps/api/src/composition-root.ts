import { systemClock, uuidGenerator } from '@acme/shared';
import type { Clock, IdGenerator } from '@acme/shared';
import {
  makeAccessAdminUseCases,
  makeAccessBlockUseCases,
  makeAccessDirectoryUseCases,
  makeAccessInvitationsUseCases,
  makeAccessMembersUseCases,
  makeAccessSettingsUseCases,
  makeAccessUseCases,
  makeAuditTrailUseCases,
  makeCreateOrganizationUseCases,
  makeIdentityUseCases,
  makeImpersonationUseCases,
} from '@acme/application';
import {
  createInMemoryAccessStore,
  createInMemoryIdentityProvisioner,
} from '@acme/infrastructure';
import type { InMemoryAccessSeed } from '@acme/infrastructure';
import {
  createNodeSecretTokenService,
  createPostgresAccessStore,
  createSupabaseAdminProvisioner,
} from '@acme/infrastructure-node';
import { createApi } from './app';
import type { AuthHookDeps } from './identity/auth-hook';
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
  /** Supabase project URL — used to provision identities on invitation activation. */
  readonly supabaseUrl?: string;
  /** Supabase SECRET (service) key for admin provisioning. Server-only; never shipped. */
  readonly supabaseSecretKey?: string;
  /** ADR-0010 owner bootstrap — comes from BOOTSTRAP_OWNER_EMAIL, only here. */
  readonly bootstrapOwnerEmail?: string | null;
  /** Browser origins allowed on /rpc (bearer auth, no cookies → no CSRF). */
  readonly corsOrigins?: ReadonlyArray<string>;
  /** Dev-only test console at GET /dev (never wire in production). */
  readonly devConsole?: () => string;
  /** standard-webhooks secret for the GoTrue password-verification hook. */
  readonly authHookSecret?: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
};

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
  authHook: AuthHookDeps,
) => ({
  authHook,
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
    sessionPolicies: store.sessionPolicies,
    sessionActivity: store.sessionActivity,
    clock,
  });
  const auditTrail = makeAuditTrailUseCases({ trail: store.auditTrail, clock });
  const accessAdmin = makeAccessAdminUseCases({
    admin: store.admin,
    settings: store.sessionPolicies,
    clock,
  });
  const accessDirectory = makeAccessDirectoryUseCases({
    staffDirectory: store.staffDirectory,
    customers: store.customers,
    clock,
  });
  const accessBlock = makeAccessBlockUseCases({
    blocks: store.blocks,
    accounts: store.admin,
    clock,
  });
  const { createOrganization } = makeCreateOrganizationUseCases({
    onboarding: store.onboarding,
    clock,
    ids,
  });
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
          sessionPolicies: store.sessionPolicies,
          sessions: store.admin,
          invitations: store.invitations,
          members: store.members,
          clock,
          ids,
          bootstrapOwnerEmail: config.bootstrapOwnerEmail ?? null,
        }).registerIdentitySession,
      }
    : undefined;

  const accessSettings = makeAccessSettingsUseCases({
    settings: store.sessionPolicies,
    clock,
  });
  // Activation needs to mint identities: real Supabase admin when configured,
  // else an in-memory provisioner (dev-stub / tests). The token service is
  // server-side everywhere (CSPRNG + one-way hash).
  const provisioner =
    config.supabaseUrl && config.supabaseSecretKey
      ? createSupabaseAdminProvisioner({
          supabaseUrl: config.supabaseUrl,
          secretKey: config.supabaseSecretKey,
        })
      : createInMemoryIdentityProvisioner();
  const accessInvitations = makeAccessInvitationsUseCases({
    invitations: store.invitations,
    accounts: store.admin,
    tokens: createNodeSecretTokenService(),
    provisioner,
    clock,
    ids,
  });
  const accessMembers = makeAccessMembersUseCases({
    members: store.members,
    accounts: store.admin,
    sessionPolicies: store.sessionPolicies,
    clock,
  });
  const procedures = createApiProcedures({
    access,
    auditTrail,
    accessAdmin,
    accessDirectory,
    accessBlock,
    impersonation,
    accessSettings,
    accessInvitations,
    accessMembers,
  });
  const app = createApi({
    procedures,
    resolveActor: access.resolveRequestActor,
    activateInvitation: accessInvitations.activateInvitation,
    createOrganization,
    ...toApiOptions(config, identity, {
      secret: config.authHookSecret ?? null,
      recordFailedLogin: auditTrail.recordFailedLogin,
    }),
  });
  return {
    app,
    procedures,
    close: async () => {
      await store.close?.();
    },
  };
};
