import { err, ok } from '@acme/shared';
import type { IdentityPurger } from '@acme/application';

/**
 * In-memory purger for the dev-stub / test API (no real Supabase). Records what
 * it was asked to erase so specs can assert the delete actually reached the
 * provider — the guards in the use case are meaningless if we cannot see
 * whether the call was made.
 */
export type InMemoryIdentityPurger = IdentityPurger & {
  readonly deleted: ReadonlyArray<string>;
};

export const createInMemoryIdentityPurger = (
  behaviour: { readonly failWith?: string } = {},
): InMemoryIdentityPurger => {
  const deleted: string[] = [];
  return {
    deleted,
    deleteIdentity: async (userId) => {
      if (behaviour.failWith) {
        return err({
          tag: 'app/identity-purge-failed',
          message: behaviour.failWith,
        });
      }
      deleted.push(userId);
      return ok(undefined);
    },
  };
};

/**
 * The fail-closed default: a Postgres deployment with no admin credentials
 * CANNOT erase an identity, and must say so rather than report a delete that
 * never happened. Irreversible operations get the loudest failure mode.
 */
export const createUnconfiguredIdentityPurger = (): IdentityPurger => ({
  deleteIdentity: async () =>
    err({
      tag: 'app/identity-purge-failed',
      message:
        'No auth-provider admin credentials are configured, so nothing was deleted.',
    }),
});
