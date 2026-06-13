import { describe, expect, it } from 'vitest';
import { productionBootErrors } from './boot-safety';

const safeProd = {
  nodeEnv: 'production',
  hasJwks: true,
  hasJwtSecret: false,
  hasDatabaseUrl: true,
  hasAuthHookSecret: true,
  devConsole: false,
};

describe('productionBootErrors', () => {
  it('passes a fully configured production boot', () => {
    expect(productionBootErrors(safeProd)).toEqual([]);
  });

  it('never blocks outside production, however insecure', () => {
    expect(
      productionBootErrors({
        nodeEnv: 'development',
        hasJwks: false,
        hasJwtSecret: false,
        hasDatabaseUrl: false,
        hasAuthHookSecret: false,
        devConsole: true,
      }),
    ).toEqual([]);
    expect(productionBootErrors({ ...safeProd, nodeEnv: undefined })).toEqual(
      [],
    );
  });

  it('refuses dev-stub identity in production', () => {
    const errors = productionBootErrors({
      ...safeProd,
      hasJwks: false,
      hasJwtSecret: false,
    });
    expect(errors.join(' ')).toContain('dev-stub');
  });

  it('accepts either JWKS or the legacy secret as a real verifier', () => {
    expect(
      productionBootErrors({ ...safeProd, hasJwks: false, hasJwtSecret: true }),
    ).toEqual([]);
  });

  it('refuses the in-memory seed, an unsigned hook, and the dev console', () => {
    const errors = productionBootErrors({
      nodeEnv: 'production',
      hasJwks: true,
      hasJwtSecret: false,
      hasDatabaseUrl: false,
      hasAuthHookSecret: false,
      devConsole: true,
    });
    expect(errors).toHaveLength(3);
    expect(errors.join(' ')).toContain('SUPABASE_DB_URL');
    expect(errors.join(' ')).toContain('AUTH_HOOK_SECRET');
    expect(errors.join(' ')).toContain('DEV_CONSOLE');
  });
});
