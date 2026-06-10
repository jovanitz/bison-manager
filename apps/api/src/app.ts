import { Hono } from 'hono';
import { z } from 'zod';
import type { AccessUseCases } from '@acme/application';
import { createAccessActorMiddleware } from './rpc/actor-middleware';
import type { ApiEnv } from './rpc/actor-middleware';
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
}) => {
  const app = new Hono<ApiEnv>();

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

  app.use('/rpc/*', createAccessActorMiddleware(deps));
  registerRpcRoutes(app, deps.procedures);

  return app;
};
