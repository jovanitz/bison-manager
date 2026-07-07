import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import type {
  AccessInvitationsUseCases,
  AccessUseCases,
  CreateOrganizationUseCases,
  EntitlementGuards,
} from '@acme/application';
import { handlePasswordVerificationHook } from './identity/auth-hook';
import type { AuthHookDeps } from './identity/auth-hook';
import { handleCreateOrganization } from './identity/create-org-route';
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
/** Public activation endpoint payload: the secret token + the chosen password. */
const activateInvitationSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(200),
  })
  .strict();

/** Activation error → HTTP: bad token = 400, existing identity = 409, else 502. */
const activationErrorStatus = (tag: string): 400 | 409 | 502 => {
  if (tag === 'app/invitation-token-invalid') return 400;
  if (tag === 'app/identity-already-exists') return 409;
  return 502;
};

/** Public activation handler (the secret token in the body is the credential). */
const handleActivate = async (
  activateInvitation: AccessInvitationsUseCases['activateInvitation'],
  c: Context,
): Promise<Response> => {
  const parsed = activateInvitationSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      {
        error: {
          tag: 'api/invalid-input',
          message: 'A token and a password (min 8 chars) are required.',
        },
      },
      400,
    );
  }
  const result = await activateInvitation(parsed.data);
  if (result.ok) return c.json({ data: result.value });
  return c.json(
    { error: { tag: result.error.tag, message: result.error.message } },
    activationErrorStatus(result.error.tag),
  );
};

export const createApi = (deps: {
  readonly procedures: ReadonlyArray<ApiProcedure>;
  readonly resolveActor: AccessUseCases['resolveRequestActor'];
  /** ADR-0016 D4: the entitlement guard behind the declarative feature gate. */
  readonly guardFeature: EntitlementGuards['guardFeature'];
  /** Public, pre-login invitation activation (the token is the credential). */
  readonly activateInvitation: AccessInvitationsUseCases['activateInvitation'];
  /** Identity-level (org-less): a verified user creates their own org. */
  readonly createOrganization?: CreateOrganizationUseCases['createOrganization'];
  readonly identity?: ApiIdentityPipeline;
  /** Browser origins allowed to call /rpc (auth is bearer-based, no cookies). */
  readonly corsOrigins?: ReadonlyArray<string>;
  /** Dev-only test console (GET /dev); absent in production wiring. */
  readonly devConsole?: () => string;
  /** GoTrue password-verification hook receiver (login.failed audit). */
  readonly authHook?: AuthHookDeps;
  /** First-run check: true while no root admin exists (drives the owner sign-up). */
  readonly needsBootstrap?: () => Promise<boolean>;
}) => {
  const app = new Hono<ApiEnv>();

  // Same CORS for the bearer-authenticated RPC surface and the public,
  // pre-login activation endpoint (browsers call both cross-origin).
  const browserCors = cors({
    origin: [...(deps.corsOrigins ?? [])],
    allowHeaders: ['authorization', 'content-type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  });
  app.use('/rpc/*', browserCors);
  app.use('/invitations/*', browserCors);
  app.use('/id/*', browserCors);
  app.use('/bootstrap-status', browserCors);

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

  const authHook = deps.authHook;
  if (authHook) {
    app.post('/hooks/password-verification', (c) =>
      handlePasswordVerificationHook(authHook, c),
    );
  }

  // Public, pre-login: the invitee sets their password from the activation
  // link. Lives OUTSIDE /rpc/* so the actor middleware never runs — the secret
  // token in the body is the only credential.
  app.post('/invitations/activate', (c) =>
    handleActivate(deps.activateInvitation, c),
  );

  // Public, pre-login first-run check: lets the dashboard show the one-time
  // owner sign-up only while no root admin exists. Read-only boolean.
  const needsBootstrap = deps.needsBootstrap;
  if (needsBootstrap) {
    app.get('/bootstrap-status', async (c) =>
      c.json({ needsBootstrap: await needsBootstrap() }),
    );
  }

  // Identity-level (org-less): a verified user creates their own organization.
  // Available only in real-identity mode (the verifier exists).
  const identity = deps.identity;
  const createOrganization = deps.createOrganization;
  if (identity && createOrganization) {
    app.post('/id/create-organization', (c) =>
      handleCreateOrganization(
        { verifier: identity.verifier, createOrganization },
        c,
      ),
    );
  }

  app.use('/rpc/*', createAccessActorMiddleware(deps));
  registerRpcRoutes(app, deps.procedures, deps.guardFeature);

  return app;
};
