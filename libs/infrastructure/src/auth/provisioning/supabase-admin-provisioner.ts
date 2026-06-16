import { err, ok } from '@acme/shared';
import type { IdentityProvisioner } from '@acme/application';

/**
 * Server-only `IdentityProvisioner`: creates a confirmed Supabase identity via
 * the GoTrue admin API. Requires the project's SECRET key, so it must only ever
 * be wired in a Node composition root (apps/api) — never the browser. GoTrue
 * answers 422 when the email already exists; we surface that distinctly so
 * activation refuses rather than risk resetting someone else's password.
 */
type ProvisionResult = Awaited<
  ReturnType<IdentityProvisioner['createIdentity']>
>;

export const createSupabaseAdminProvisioner = (config: {
  readonly supabaseUrl: string;
  readonly secretKey: string;
}): IdentityProvisioner => ({
  createIdentity: async ({ email, password }): Promise<ProvisionResult> => {
    let response: Response;
    try {
      response = await fetch(`${config.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: config.secretKey,
          authorization: `Bearer ${config.secretKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
    } catch (cause) {
      return err({
        tag: 'app/identity-provision-failed',
        message: `admin createUser request failed: ${String(cause)}`,
      });
    }

    if (response.ok) {
      const body = (await response.json()) as { readonly id: string };
      return ok({ userId: body.id });
    }
    if (response.status === 422) {
      return err({
        tag: 'app/identity-already-exists',
        message: 'An identity already exists for this email.',
      });
    }
    return err({
      tag: 'app/identity-provision-failed',
      message: `admin createUser responded ${response.status}`,
    });
  },
});
