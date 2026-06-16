import { type Result, err, ok } from '@acme/shared';
import type {
  ActivationGateway,
  ActivationGatewayError,
} from '@acme/application';

const KNOWN_TAGS = new Set<ActivationGatewayError['tag']>([
  'app/invitation-token-invalid',
  'app/identity-already-exists',
  'app/identity-provision-failed',
]);

/**
 * Pre-login activation adapter: a plain `fetch` to the PUBLIC
 * `POST /invitations/activate` endpoint — deliberately no bearer token (the
 * secret token in the body is the credential). The server's tagged error is
 * passed through when recognized; anything else collapses into a gateway error.
 */
export const createRpcActivationGateway = (deps: {
  readonly baseUrl: string;
}): ActivationGateway => ({
  activate: async (input) => {
    const base = deps.baseUrl.replace(/\/$/, '');
    type Ok = { readonly data: { readonly email: string } };
    type Err = {
      readonly error: { readonly tag: string; readonly message: string };
    };
    let response: Response;
    try {
      response = await fetch(`${base}/invitations/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch (cause) {
      return err({
        tag: 'app/access-gateway-error',
        message: `Activation request failed: ${String(cause)}`,
      });
    }

    if (response.ok) {
      const body = (await response.json()) as Ok;
      return ok(body.data);
    }
    const body = (await response.json().catch(() => null)) as Err | null;
    const tag = body?.error.tag;
    const message =
      body?.error.message ?? `Activation failed (${response.status}).`;
    const error: ActivationGatewayError =
      tag && KNOWN_TAGS.has(tag as ActivationGatewayError['tag'])
        ? { tag: tag as ActivationGatewayError['tag'], message }
        : { tag: 'app/access-gateway-error', message };
    return err(error) as Result<
      { readonly email: string },
      ActivationGatewayError
    >;
  },
});
