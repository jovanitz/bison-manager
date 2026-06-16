import type { Context } from 'hono';
import { z } from 'zod';
import type {
  AccessTokenVerifier,
  CreateOrganizationUseCases,
} from '@acme/application';

const createOrgSchema = z.object({ name: z.string().min(1).max(200) }).strict();

const bearerToken = (header: string | undefined): string | null =>
  header?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;

const unauthorized = (c: Context) =>
  c.json(
    {
      error: { tag: 'api/unauthorized', message: 'A valid token is required.' },
    },
    401,
  );

/**
 * Identity-level handler (no actor): a verified but ORG-LESS user creates their
 * own organization. Authenticates purely from the JWT (the user has no app
 * session/membership yet), then provisions the account + customer-admin
 * membership. Lives outside /rpc/* so the actor middleware never runs.
 */
export type CreateOrgRouteDeps = {
  readonly verifier: AccessTokenVerifier;
  readonly createOrganization: CreateOrganizationUseCases['createOrganization'];
};

export const handleCreateOrganization = async (
  deps: CreateOrgRouteDeps,
  c: Context,
): Promise<Response> => {
  const token = bearerToken(c.req.header('authorization'));
  if (!token) return unauthorized(c);
  const verified = await deps.verifier.verifyAccessToken(token);
  if (!verified.ok) return unauthorized(c);

  const parsed = createOrgSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json(
      { error: { tag: 'api/invalid-input', message: 'A name is required.' } },
      400,
    );
  }

  const result = await deps.createOrganization({
    userId: verified.value.userId,
    email: verified.value.email,
    name: parsed.data.name,
  });
  if (result.ok) return c.json({ data: result.value });
  return c.json(
    { error: { tag: result.error.tag, message: result.error.message } },
    400,
  );
};
