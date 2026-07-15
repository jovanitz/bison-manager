import { err, ok } from '@acme/shared';
import type { IdentityPurger } from '@acme/application';

/**
 * Server-only `IdentityPurger`: erases a Supabase identity via the GoTrue admin
 * API. Needs the project's SECRET key, so it may only be wired in a Node
 * composition root (apps/api) — never the browser.
 *
 * Fails CLOSED on every non-2xx: nothing is reported as deleted unless GoTrue
 * says it deleted it. A 404 is a failure too, not a silent success — being
 * asked to erase a user that is not there means our view of the world is wrong,
 * and that is exactly when a destructive operation should stop.
 */
export const createSupabaseIdentityPurger = (config: {
  readonly supabaseUrl: string;
  readonly secretKey: string;
}): IdentityPurger => ({
  deleteIdentity: async (userId) => {
    let response: Response;
    try {
      response = await fetch(
        `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: config.secretKey,
            authorization: `Bearer ${config.secretKey}`,
          },
        },
      );
    } catch (cause) {
      return err({
        tag: 'app/identity-purge-failed',
        message: `admin deleteUser request failed: ${String(cause)}`,
      });
    }
    if (!response.ok) {
      return err({
        tag: 'app/identity-purge-failed',
        message: `admin deleteUser refused (${response.status}).`,
      });
    }
    return ok(undefined);
  },
});
