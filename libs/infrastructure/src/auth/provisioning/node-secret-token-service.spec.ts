import { describe, expect, it } from 'vitest';
import { createNodeSecretTokenService } from './node-secret-token-service';

describe('createNodeSecretTokenService', () => {
  const service = createNodeSecretTokenService();

  it('issues a URL-safe token with a matching SHA-256 hex hash', () => {
    const { token, tokenHash } = service.issue();
    // base64url: no +,/,= ; SHA-256 hex: 64 chars
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    // hashOf re-derives the same hash from the plaintext
    expect(service.hashOf(token)).toBe(tokenHash);
  });

  it('never stores the plaintext: the hash is not the token', () => {
    const { token, tokenHash } = service.issue();
    expect(tokenHash).not.toBe(token);
  });

  it('issues unique tokens (CSPRNG)', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => service.issue().token),
    );
    expect(tokens.size).toBe(50);
  });
});
