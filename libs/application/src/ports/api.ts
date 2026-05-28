import type { Result } from '@acme/shared';

/**
 * API transport port — provider agnostic.
 *
 * REST, GraphQL, AppSync and tRPC differ wildly in their wire format, but the
 * application only needs a way to "send a typed request and get a typed result
 * or a transport error". Each protocol gets an adapter; repositories are written
 * against this port, so moving from REST to AppSync touches one adapter and the
 * composition root — never the use cases.
 */
export type ApiError = {
  readonly tag: 'api/network' | 'api/status' | 'api/decode' | 'api/timeout';
  readonly message: string;
  readonly status?: number;
  readonly cause?: unknown;
};

export type ApiRequest<TBody = unknown> = {
  readonly operation: string;
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path?: string;
  readonly query?: Readonly<Record<string, string | number | boolean>>;
  readonly body?: TBody;
  readonly signal?: AbortSignal;
};

export type ApiClient = {
  readonly request: <TResponse, TBody = unknown>(
    req: ApiRequest<TBody>,
  ) => Promise<Result<TResponse, ApiError>>;
};
