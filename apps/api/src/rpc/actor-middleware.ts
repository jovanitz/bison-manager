import { createMiddleware } from 'hono/factory';
import type {
  AccessTokenVerifier,
  AccessUseCases,
  IdentityUseCases,
  SessionContext,
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
};

const bearerToken = (header: string | undefined): string | null => {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
};

/**
 * Origin facts captured per request — feeds the sessions' device/IP columns.
 * x-forwarded-for is only meaningful behind a trusted proxy; first hop wins.
 */
const requestContext = (headers: {
  readonly userAgent: string | undefined;
  readonly forwardedFor: string | undefined;
}): SessionContext => ({
  userAgent: headers.userAgent ?? null,
  ipAddress: headers.forwardedFor?.split(',')[0]?.trim() || null,
});

const toSessionId = async (
  identity: ApiIdentityPipeline,
  token: string,
  context: SessionContext,
): Promise<string | null> => {
  const verified = await identity.verifier.verifyAccessToken(token);
  if (!verified.ok) return null;
  // Initial expiry comes from the per-kind session policy (registration).
  const registered = await identity.registerSession({
    userId: verified.value.userId,
    sessionId: verified.value.sessionId,
    email: verified.value.email,
    context,
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

    const context = requestContext({
      userAgent: c.req.header('user-agent'),
      forwardedFor: c.req.header('x-forwarded-for'),
    });
    const sessionId = deps.identity
      ? await toSessionId(deps.identity, token, context)
      : token;
    if (!sessionId) return unauthorized();

    const actor = await deps.resolveActor({ sessionId, context });
    if (!actor.ok) return unauthorized();

    c.set('actor', actor.value);
    return next();
  });
