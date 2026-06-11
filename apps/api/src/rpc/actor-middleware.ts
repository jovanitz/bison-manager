import { createMiddleware } from 'hono/factory';
import type { Clock } from '@acme/shared';
import type {
  AccessTokenVerifier,
  AccessUseCases,
  IdentityUseCases,
} from '@acme/application';
import type { AccessActor } from '@acme/domain';

/** Hono environment: the resolved actor every `/rpc/*` handler can rely on. */
export type ApiEnv = {
  readonly Variables: {
    readonly actor: AccessActor;
  };
};

/**
 * Real identity mode: verify the Supabase JWT, then register the session on
 * first contact (login bookkeeping + owner/customer onboarding). Absent in
 * the dev/test stub mode, where the bearer token IS the session id.
 */
export type ApiIdentityPipeline = {
  readonly verifier: AccessTokenVerifier;
  readonly registerSession: IdentityUseCases['registerIdentitySession'];
  readonly sessionTtlMs: number;
  readonly clock: Clock;
};

const bearerToken = (header: string | undefined): string | null => {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
};

const toSessionId = async (
  identity: ApiIdentityPipeline,
  token: string,
): Promise<string | null> => {
  const verified = await identity.verifier.verifyAccessToken(token);
  if (!verified.ok) return null;
  const expiresAt = new Date(
    identity.clock.now().getTime() + identity.sessionTtlMs,
  ).toISOString();
  const registered = await identity.registerSession({
    userId: verified.value.userId,
    sessionId: verified.value.sessionId,
    email: verified.value.email,
    sessionExpiresAt: expiresAt,
  });
  return registered.ok ? registered.value.sessionId : null;
};

/**
 * The authentication edge of the pipeline. The token only ever yields a
 * session id; authorization facts are then loaded fresh from the store by
 * `resolveRequestActor`, so a revoked session or disabled account is rejected
 * immediately, token or no token.
 *
 * Every failure collapses into the same plain 401: the response must not
 * reveal whether a token is malformed, a session unknown, revoked, expired or
 * the account disabled.
 */
export const createAccessActorMiddleware = (deps: {
  readonly resolveActor: AccessUseCases['resolveRequestActor'];
  readonly identity?: ApiIdentityPipeline;
}) =>
  createMiddleware<ApiEnv>(async (c, next) => {
    const unauthorized = () =>
      c.json(
        {
          error: {
            tag: 'api/unauthorized',
            message: 'A valid bearer token is required.',
          },
        },
        401,
      );

    const token = bearerToken(c.req.header('authorization'));
    if (!token) return unauthorized();

    const sessionId = deps.identity
      ? await toSessionId(deps.identity, token)
      : token;
    if (!sessionId) return unauthorized();

    const actor = await deps.resolveActor({ sessionId });
    if (!actor.ok) return unauthorized();

    c.set('actor', actor.value);
    return next();
  });
