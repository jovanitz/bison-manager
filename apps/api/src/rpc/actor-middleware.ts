import { createMiddleware } from 'hono/factory';
import type { AccessUseCases } from '@acme/application';
import type { AccessActor } from '@acme/domain';

/** Hono environment: the resolved actor every `/rpc/*` handler can rely on. */
export type ApiEnv = {
  readonly Variables: {
    readonly actor: AccessActor;
  };
};

const bearerToken = (header: string | undefined): string | null => {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
};

/**
 * The authentication edge of the pipeline. Phase-3 identity stub: the bearer
 * token IS the session id (phase 4 swaps in JWT verification that *yields* a
 * session id — everything after the token stays as-is). Authorization facts
 * are then loaded fresh from the store by `resolveRequestActor`, so a revoked
 * session or disabled account is rejected immediately, token or no token.
 *
 * Every failure collapses into the same plain 401: the response must not
 * reveal whether a session is unknown, revoked, expired or disabled.
 */
export const createAccessActorMiddleware = (deps: {
  readonly resolveActor: AccessUseCases['resolveRequestActor'];
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

    const actor = await deps.resolveActor({ sessionId: token });
    if (!actor.ok) return unauthorized();

    c.set('actor', actor.value);
    return next();
  });
