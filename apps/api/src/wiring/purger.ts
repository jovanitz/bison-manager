import {
  createInMemoryIdentityPurger,
  createUnconfiguredIdentityPurger,
} from '@acme/infrastructure';
import { createSupabaseIdentityPurger } from '@acme/infrastructure-node';
import type { IdentityPurger } from '@acme/application';
import type { ApiConfig } from './config';
import type { AccessStore } from './store';

/**
 * Who may erase an identity — the destructive half of the auth provider's admin
 * surface, chosen exactly like the provisioner:
 *
 * - real GoTrue admin when the secret key is configured;
 * - otherwise the in-memory store's OWN purger, so the dev-stub's orphan view
 *   and its deletes stay coherent (a purge that the orphan list ignored would
 *   hide the very bug this slice guards against);
 * - and if a Postgres deployment has no admin credentials at all, a fail-closed
 *   purger that refuses out loud instead of reporting a phantom delete.
 */
export const toIdentityPurger = (
  config: ApiConfig,
  store: AccessStore,
): IdentityPurger => {
  if (config.supabaseUrl && config.supabaseSecretKey) {
    return createSupabaseIdentityPurger({
      supabaseUrl: config.supabaseUrl,
      secretKey: config.supabaseSecretKey,
    });
  }
  return 'identityPurger' in store && store.identityPurger
    ? store.identityPurger
    : createUnconfiguredIdentityPurger();
};

/** Spec-only escape hatch kept exported so tests can assert on the deletes. */
export { createInMemoryIdentityPurger };
