import { verify, verifyWithJwks } from 'hono/jwt';
import { err, ok } from '@acme/shared';
import { invalidAccessToken } from '@acme/application';
import type { AccessTokenVerifier } from '@acme/application';
import type { JWTPayload } from 'hono/utils/jwt/types';

/**
 * Supabase access-token verifier. Modern projects sign with asymmetric keys
 * (ES256 + kid) published at `/auth/v1/.well-known/jwks.json` — configure
 * `jwksUrl`. Legacy projects (and the specs) sign HS256 with the shared JWT
 * secret — configure `jwtSecret`. Either way the token proves identity ONLY
 * (`sub`, `session_id`, `email`); authorization is resolved from the store
 * afterwards. hono/jwt throws on any invalid token — caught here at the
 * adapter edge and collapsed into one expected `Result` error.
 */
export type SupabaseTokenVerifierConfig =
  | { readonly jwksUrl: string }
  | { readonly jwtSecret: string };

const verifyToken = (
  config: SupabaseTokenVerifierConfig,
  token: string,
): Promise<JWTPayload> =>
  'jwksUrl' in config
    ? verifyWithJwks(token, {
        jwks_uri: config.jwksUrl,
        allowedAlgorithms: ['ES256', 'RS256'],
      })
    : verify(token, config.jwtSecret, 'HS256');

export const createSupabaseTokenVerifier = (
  config: SupabaseTokenVerifierConfig,
): AccessTokenVerifier => ({
  verifyAccessToken: async (token) => {
    try {
      const payload = await verifyToken(config, token);
      const userId = typeof payload['sub'] === 'string' ? payload['sub'] : null;
      const sessionId =
        typeof payload['session_id'] === 'string'
          ? payload['session_id']
          : null;
      if (!userId || !sessionId) {
        return err(
          invalidAccessToken('Token lacks the sub/session_id claims.'),
        );
      }
      const email =
        typeof payload['email'] === 'string' ? payload['email'] : null;
      return ok({ userId, sessionId, email });
    } catch {
      return err(invalidAccessToken('Token verification failed.'));
    }
  },
});
