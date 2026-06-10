import type { Context, Hono } from 'hono';
import { fromThrowable } from '@acme/shared';
import type { ApiEnv } from './actor-middleware';
import { statusForErrorTag } from './procedure';
import type { ApiErrorStatus, ApiProcedure } from './procedure';

/**
 * The generated half of the pipeline: one `POST /rpc/<name>` route per
 * declared procedure. Each request flows
 * actor (middleware) → JSON body → zod parse → handler → Result → HTTP.
 * Unknown procedure names never register a route, so they 404 by omission.
 */
const apiError = (
  c: Context<ApiEnv>,
  status: ApiErrorStatus,
  tag: string,
  message: string,
) => c.json({ error: { tag, message } }, status);

const readJsonBody = async (c: Context<ApiEnv>) => {
  const text = await c.req.text();
  if (text.trim() === '') return { ok: true as const, value: {} };
  return fromThrowable(() => JSON.parse(text) as unknown);
};

const describeIssues = (error: {
  readonly issues: ReadonlyArray<{
    readonly path: ReadonlyArray<string | number>;
    readonly message: string;
  }>;
}): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '(input)'}: ${issue.message}`)
    .join('; ');

const procedureRoute =
  (procedure: ApiProcedure) => async (c: Context<ApiEnv>) => {
    const body = await readJsonBody(c);
    if (!body.ok) {
      return apiError(c, 400, 'api/invalid-input', 'Body must be valid JSON.');
    }

    const input = procedure.input.safeParse(body.value);
    if (!input.success) {
      return apiError(c, 400, 'api/invalid-input', describeIssues(input.error));
    }

    const result = await procedure.handler({
      actor: c.get('actor'),
      input: input.data,
    });
    if (!result.ok) {
      return apiError(
        c,
        statusForErrorTag(result.error.tag),
        result.error.tag,
        result.error.message,
      );
    }
    // `void` use cases serialize as `data: null`, keeping the envelope stable.
    return c.json({ data: result.value ?? null });
  };

export const registerRpcRoutes = (
  app: Hono<ApiEnv>,
  procedures: ReadonlyArray<ApiProcedure>,
): void => {
  for (const procedure of procedures) {
    app.post(`/rpc/${procedure.name}`, procedureRoute(procedure));
  }
};
