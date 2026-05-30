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

/** Resolve the request path + query into an absolute URL. */
const buildUrl = <TBody>(req: ApiRequest<TBody>, baseUrl: string): URL => {
  const url = new URL(req.path ?? '', baseUrl);
  for (const [k, v] of Object.entries(req.query ?? {})) {
    url.searchParams.set(k, String(v));
  }
  return url;
};

/** Base headers plus a bearer token when an auth provider is wired. */
const buildHeaders = async (
  auth?: AuthProvider,
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (!auth) return headers;
  const token = await auth.getAccessToken();
  if (token.ok) headers['authorization'] = `Bearer ${token.value}`;
  return headers;
};

/**
 * Build the init incrementally so optional fields are omitted rather than set to
 * `undefined` (required by `exactOptionalPropertyTypes`).
 */
const buildInit = <TBody>(
  req: ApiRequest<TBody>,
  headers: Record<string, string>,
): RequestInit => {
  const init: RequestInit = { method: req.method ?? 'GET', headers };
  if (req.body !== undefined) init.body = JSON.stringify(req.body);
  if (req.signal !== undefined) init.signal = req.signal;
  return init;
};

export const createHttpApiClient = (config: HttpApiClientConfig): ApiClient => {
  const doFetch = config.fetchImpl ?? fetch;

  const request = async <TResponse, TBody>(
    req: ApiRequest<TBody>,
  ): Promise<Result<TResponse, ApiError>> => {
    const url = buildUrl(req, config.baseUrl);
    const init = buildInit(req, await buildHeaders(config.auth));

    try {
      const res = await doFetch(url.toString(), init);
      if (!res.ok) {
        return err({
          tag: 'api/status',
          message: `Request ${req.operation} failed`,
          status: res.status,
        });
      }
      return ok((await res.json()) as TResponse);
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
