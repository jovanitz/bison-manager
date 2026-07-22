import type { Clock, IdGenerator } from '@acme/shared';
import type { Charge, Payment } from '@acme/domain';
import type { NotificationSender } from '@acme/application';
import type {
  InMemoryAccessSeed,
  InMemoryBillingSeed,
} from '@acme/infrastructure';
import type { AuthHookDeps } from '../identity/auth-hook';
import type { createSupabaseTokenVerifier } from '../identity/token-verifier';
import type { ApiIdentityPipeline } from '../rpc/actor-middleware';
import type { ApiProcedure } from '../rpc/procedure';

/**
 * The composition root's configuration surface + its small pure helpers,
 * extracted here so `composition-root.ts` stays pure assembly (and under the
 * file-size cap).
 */
export type ApiConfig = {
  readonly seed?: InMemoryAccessSeed;
  /** In-memory billing world (plans + subscriptions) for dev/tests (ADR-0016). */
  readonly billingSeed?: InMemoryBillingSeed;
  /** Dev-stub only: pre-populated ledger (charges + payments) so the org-detail
   *  Ledger card has a real payment to void/refund. Never set from tests. */
  readonly ledgerSeed?: {
    readonly charges: readonly Charge[];
    readonly payments: readonly Payment[];
  };
  /**
   * TEST-ONLY seam: extra procedures appended to the registry. Used by the
   * pipeline contract tests (the declarative feature gate has no production
   * declarer yet); never set from `main.ts`.
   */
  readonly extraProcedures?: ReadonlyArray<ApiProcedure>;
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
  /**
   * Public origin of the APP the invitee opens (the dashboard), used to build
   * activation links. The API cannot infer it — it may sit behind any host.
   */
  readonly appBaseUrl?: string;
  /**
   * Outbound email. Omit and nothing is delivered: the fail-closed sender says
   * so out loud rather than reporting a phantom success.
   */
  readonly notifications?: NotificationSender;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
};

export const toVerifierConfig = (
  config: ApiConfig,
): Parameters<typeof createSupabaseTokenVerifier>[0] | null => {
  if (config.jwksUrl) return { jwksUrl: config.jwksUrl };
  if (config.jwtSecret) return { jwtSecret: config.jwtSecret };
  return null;
};

/** The test-only probes, defaulted — keeps the root's complexity budget flat. */
export const extraProceduresOf = (
  config: ApiConfig,
): ReadonlyArray<ApiProcedure> => config.extraProcedures ?? [];

/** Optional createApi deps (exactOptionalPropertyTypes: omit, never undefined). */
export const toApiOptions = (
  config: ApiConfig,
  identity: ApiIdentityPipeline | undefined,
  authHook: AuthHookDeps,
) => ({
  authHook,
  ...(identity ? { identity } : {}),
  ...(config.corsOrigins ? { corsOrigins: config.corsOrigins } : {}),
  ...(config.devConsole ? { devConsole: config.devConsole } : {}),
});
