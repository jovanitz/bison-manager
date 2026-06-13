/**
 * Fail-closed boot checks. The composition root degrades gracefully to
 * developer-friendly defaults (in-memory seed, bearer-token-as-session-id stub
 * identity, unsigned webhook, dev console) — convenient locally, catastrophic
 * in production. In production every one of those defaults is a refusal to
 * boot, so a missing env var can never silently open the gate.
 */
export type BootSafetyInput = {
  /** process.env.NODE_ENV — checks only apply when this is 'production'. */
  readonly nodeEnv: string | undefined;
  readonly hasJwks: boolean;
  readonly hasJwtSecret: boolean;
  readonly hasDatabaseUrl: boolean;
  readonly hasAuthHookSecret: boolean;
  readonly devConsole: boolean;
};

/**
 * The misconfigurations that must abort a production boot. An empty list means
 * the configuration is safe to serve. Outside production the list is always
 * empty (local dev keeps its conveniences).
 */
export const productionBootErrors = (
  input: BootSafetyInput,
): ReadonlyArray<string> => {
  if (input.nodeEnv !== 'production') return [];
  const errors: string[] = [];
  if (!input.hasJwks && !input.hasJwtSecret) {
    errors.push(
      'Identity is in dev-stub mode: set SUPABASE_URL (JWKS) or ' +
        'SUPABASE_JWT_SECRET. Otherwise the bearer token is trusted as a ' +
        'session id WITHOUT verifying any JWT.',
    );
  }
  if (!input.hasDatabaseUrl) {
    errors.push(
      'No SUPABASE_DB_URL: refusing to serve the in-memory dev seed (its ' +
        'fixed `session-<preset>` tokens grant full access).',
    );
  }
  if (!input.hasAuthHookSecret) {
    errors.push(
      'No AUTH_HOOK_SECRET: the login-failed webhook would accept unsigned ' +
        'requests (forged audit events).',
    );
  }
  if (input.devConsole) {
    errors.push('DEV_CONSOLE must not be enabled in production.');
  }
  return errors;
};
