import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import type { AccessUseCases } from '@acme/application';
import { createAccessActorMiddleware } from './rpc/actor-middleware';
import type { ApiEnv, ApiIdentityPipeline } from './rpc/actor-middleware';
import { registerRpcRoutes } from './rpc/routes';
import type { ApiProcedure } from './rpc/procedure';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
});

/**
 * Builds the HTTP app — pure assembly, wired by the composition root.
 * `/health` is the only public route; everything else lives under `/rpc/*`,
 * where the actor middleware runs before any generated procedure route.
 */
export const createApi = (deps: {
  readonly procedures: ReadonlyArray<ApiProcedure>;
  readonly resolveActor: AccessUseCases['resolveRequestActor'];
  readonly identity?: ApiIdentityPipeline;
  /** Browser origins allowed to call /rpc (auth is bearer-based, no cookies). */
  readonly corsOrigins?: ReadonlyArray<string>;
  /** Dev-only test console (GET /dev); absent in production wiring. */
  readonly devConsole?: () => string;
}) => {
  const app = new Hono<ApiEnv>();

  app.use(
    '/rpc/*',
    cors({
      origin: [...(deps.corsOrigins ?? [])],
      allowHeaders: ['authorization', 'content-type'],
      allowMethods: ['POST', 'OPTIONS'],
    }),
  );

  app.get('/health', (c) => {
    const body = healthResponseSchema.safeParse({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
    });
    if (!body.success) {
      return c.json({ status: 'error' }, 500);
    }
    return c.json(body.data);
  });

  const devConsole = deps.devConsole;
  if (devConsole) {
    app.get('/dev', (c) => c.html(devConsole()));
  }

  app.use('/rpc/*', createAccessActorMiddleware(deps));
  registerRpcRoutes(app, deps.procedures);

  return app;
};
