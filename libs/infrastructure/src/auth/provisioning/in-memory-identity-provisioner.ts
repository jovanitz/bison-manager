import { err, ok } from '@acme/shared';
import type { IdentityProvisioner } from '@acme/application';

/**
 * In-memory `IdentityProvisioner` for the dev-stub / test API mode (no real
 * Supabase). Mints a fake user id and rejects a repeated email with
 * `identity-already-exists`, mirroring the GoTrue admin behaviour the
 * activation flow depends on.
 */
export const createInMemoryIdentityProvisioner = (seed?: {
  readonly emails?: ReadonlyArray<string>;
}): IdentityProvisioner => {
  const seen = new Set((seed?.emails ?? []).map((e) => e.toLowerCase()));
  let counter = 0;
  return {
    createIdentity: async ({ email }) => {
      const key = email.toLowerCase();
      if (seen.has(key)) {
        return err({
          tag: 'app/identity-already-exists',
          message: 'An identity already exists for this email.',
        });
      }
      seen.add(key);
      counter += 1;
      return ok({ userId: `user-provisioned-${counter}` });
    },
  };
};
