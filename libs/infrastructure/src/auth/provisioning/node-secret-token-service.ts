import { createHash, randomBytes } from 'node:crypto';
import type { SecretTokenService } from '@acme/application';

/** SHA-256 hex — one-way, so a stored hash never yields the token back. */
const sha256 = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Server-only `SecretTokenService` (uses node:crypto, never the browser
 * bundle). The token is 32 bytes of CSPRNG entropy, base64url-encoded for a
 * URL-safe activation link; only its hash is ever persisted.
 */
export const createNodeSecretTokenService = (): SecretTokenService => ({
  issue: () => {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenHash: sha256(token) };
  },
  hashOf: (token) => sha256(token),
});
