import type { z } from 'zod';
import type { Result, TaggedError } from '@acme/shared';
import type { AccessAction, AccessActor, PlanFeature } from '@acme/domain';

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
  /**
   * Declarative premium-feature gate (ADR-0016 Decision 4). UNLIKE `action`,
   * the pipeline enforces this one centrally (entitlement guards, after actor
   * resolution, before the handler): a feature check needs no resource or
   * scope — the actor's account + its plan suffice — so a forgotten
   * server-side gate becomes unrepresentable. Denials surface the guard's own
   * billing tags (402/404), never `app/access-denied`; staff accounts are
   * exempt by the guard itself.
   */
  readonly feature?: PlanFeature;
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
  readonly feature?: PlanFeature;
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

export type ApiErrorStatus = 400 | 401 | 402 | 403 | 404 | 409 | 502;

/**
 * Exact-tag mappings that beat the family rules below. Billing-phase denials
 * are upsell-grade (ADR-0016 Decision 5): 402, never 403 — that status stays
 * reserved for authorization. A reasonless staff lever is a request-shape
 * defect like a zod failure (400); a live plan whose key has no code seed has
 * no floor to reset to (404).
 */
const EXACT_TAG_STATUS: Readonly<Record<string, ApiErrorStatus>> = {
  'app/access-denied': 403,
  'app/impersonation-grant-not-owned': 403,
  'app/access-actor-not-found': 401,
  'app/subscription-expired': 402,
  'app/feature-not-in-plan': 402,
  'app/reason-required': 400,
  'app/plan-seed-missing': 404,
  // An email provider outage is not a state conflict — it is an UPSTREAM
  // failure. 502 says "our dependency broke", so the client can offer a retry
  // instead of showing the user a nonsensical 409.
  'app/notification-failed': 502,
};

/**
 * The single `Result`-tag → HTTP-status translation:
 * - exact mappings above (403 authorization, 401 dead session, 402 billing)
 * - `*-not-found` → 404
 * - `domain/*` → 400 (input that passed zod but violated a domain rule)
 * - upstream provider failures (email) → 502
 * - anything else → 409: expected state conflicts (already-disabled,
 *   plan-key-taken, plan-concurrently-modified, plan-limit-exceeded,
 *   plan-retired, and default-plan-missing — an operator-config failure kept
 *   in the conflict family).
 */
export const statusForErrorTag = (tag: string): ApiErrorStatus => {
  const exact = EXACT_TAG_STATUS[tag];
  if (exact) return exact;
  if (tag.endsWith('-not-found')) return 404;
  if (tag.startsWith('domain/')) return 400;
  return 409;
};
