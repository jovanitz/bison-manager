import { type Result, err, ok } from '@acme/shared';
import type { ApiClient, ApiError, ApiRequest } from '@acme/application';
import type { AuthProvider } from '@acme/application';

/**
 * REST adapter for the `ApiClient` port, built on `fetch`.
 *
 * It attaches a bearer token from the injected `AuthProvider` (note: the auth
 * provider is itself a port, so REST-over-Cognito and REST-over-Auth0 are the
 * same code), and normalizes every failure into a typed `ApiError`. A GraphQL,
 * AppSync, or tRPC adapter would implement the identical `ApiClient` shape — the
 * repositories below would not change.
 */
export type HttpApiClientConfig = {
  readonly baseUrl: string;
  readonly auth?: AuthProvider;
  readonly fetchImpl?: typeof fetch;
};

export const createHttpApiClient = (
  config: HttpApiClientConfig,
): ApiClient => {
  const doFetch = config.fetchImpl ?? fetch;

  const request = async <TResponse, TBody>(
    req: ApiRequest<TBody>,
  ): Promise<Result<TResponse, ApiError>> => {
    const url = new URL(req.path ?? '', config.baseUrl);
    for (const [k, v] of Object.entries(req.query ?? {})) {
      url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (config.auth) {
      const token = await config.auth.getAccessToken();
      if (token.ok) headers['authorization'] = `Bearer ${token.value}`;
    }

    // Build the init incrementally so optional fields are omitted rather than
    // set to `undefined` (required by `exactOptionalPropertyTypes`).
    const init: RequestInit = { method: req.method ?? 'GET', headers };
    if (req.body !== undefined) init.body = JSON.stringify(req.body);
    if (req.signal !== undefined) init.signal = req.signal;

    try {
      const res = await doFetch(url.toString(), init);

      if (!res.ok) {
        return err({
          tag: 'api/status',
          message: `Request ${req.operation} failed`,
          status: res.status,
        });
      }
      const data = (await res.json()) as TResponse;
      return ok(data);
    } catch (cause) {
      const isAbort = cause instanceof Error && cause.name === 'AbortError';
      return err({
        tag: isAbort ? 'api/timeout' : 'api/network',
        message: `Request ${req.operation} could not be completed`,
        cause,
      });
    }
  };

  return { request };
};
