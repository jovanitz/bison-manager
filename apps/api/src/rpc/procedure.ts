import type { z } from 'zod';
import type { Result, TaggedError } from '@acme/shared';
import type { AccessAction, AccessActor } from '@acme/domain';

/**
 * One declared API capability. The registry of these drives everything:
 * routing today, and the MCP / AI-gateway tool registry tomorrow — a
 * procedure's name + input schema + required action IS a tool description.
 *
 * `action` is declarative metadata for that registry. Enforcement never reads
 * it: every use case authorizes itself through `authorizeAccessAction` with
 * the concrete resource in hand (a registry-level check could not see scopes
 * or grants, so it would either over- or under-allow).
 */
export type ApiProcedureContext = {
  readonly actor: AccessActor;
  readonly input: unknown;
};

export type ApiProcedure = {
  readonly name: string;
  readonly summary: string;
  readonly action: AccessAction | null;
  readonly input: z.ZodTypeAny;
  readonly handler: (
    context: ApiProcedureContext,
  ) => Promise<Result<unknown, TaggedError>>;
};

/**
 * Typed constructor: the handler sees the schema's inferred output, the
 * registry stores the type-erased shape. The single cast is sound because the
 * pipeline only calls `handler` with input parsed by this same schema.
 */
export const defineApiProcedure = <Schema extends z.ZodTypeAny>(procedure: {
  readonly name: string;
  readonly summary: string;
  readonly action: AccessAction | null;
  readonly input: Schema;
  readonly handler: (context: {
    readonly actor: AccessActor;
    readonly input: z.infer<Schema>;
  }) => Promise<Result<unknown, TaggedError>>;
}): ApiProcedure => ({
  ...procedure,
  handler: (context) =>
    procedure.handler({
      actor: context.actor,
      input: context.input as z.infer<Schema>,
    }),
});

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409;

/**
 * The single `Result`-tag → HTTP-status translation:
 * - `app/access-denied`, `app/impersonation-grant-not-owned` → 403
 *   (authenticated, but not allowed)
 * - `app/access-actor-not-found` → 401 (the session vanished mid-request)
 * - `*-not-found` → 404
 * - `domain/*` → 400 (input that passed zod but violated a domain rule)
 * - anything else → 409 (expected state conflicts: already-disabled, …)
 */
export const statusForErrorTag = (tag: string): ApiErrorStatus => {
  if (tag === 'app/access-denied') return 403;
  if (tag === 'app/impersonation-grant-not-owned') return 403;
  if (tag === 'app/access-actor-not-found') return 401;
  if (tag.endsWith('-not-found')) return 404;
  if (tag.startsWith('domain/')) return 400;
  return 409;
};
