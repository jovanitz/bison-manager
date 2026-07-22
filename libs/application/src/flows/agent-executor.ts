import { type Clock, type Result, err } from '@acme/shared';
import type { FlowCommand } from './registry-types';
import { findFlowCommand } from './registry-types';

/**
 * A prompt-driven agent's request to run one flow: a tool NAME + its raw ARGS.
 * The model produced both — NEITHER is trusted. The executor treats them as a
 * proposal, gated below.
 */
export type AgentToolCall = {
  readonly name: string;
  readonly input: unknown;
};

export type AgentError = { readonly tag: string; readonly message: string };

/** A read-only tool the agent may enumerate + call (deny-by-default surface). */
export type AgentTool = {
  readonly name: string;
  readonly description: string;
  readonly kind: 'query';
};

/**
 * The read-only allow-list exposed to a prompt-driven agent: ONLY `query`
 * flows. Control C of the audit's AI blueprint — nothing reaches the agent's
 * tool surface unless it is a read. A `command` (mutation) is never listed, so
 * the model cannot even discover one to try.
 */
export const readOnlyAgentTools = <Deps>(
  registry: ReadonlyArray<FlowCommand<Deps>>,
): ReadonlyArray<AgentTool> =>
  registry
    .filter((command) => command.kind === 'query')
    .map((command) => ({
      name: command.name,
      description: command.description,
      kind: 'query',
    }));

/**
 * Run one agent-requested flow through the SAME core the UI uses, with four
 * gates BEFORE anything runs (the AI blueprint, controls A–E):
 *   1. the tool must exist in the registry — an unknown name is refused;
 *   2. it must be a `query` — a `command` mutation is refused here, before any
 *      dep is touched, no matter what the model named (read-only executor);
 *   3. its args are validated by the flow's own Zod schema (untrusted input);
 *   4. it then runs with the caller's `deps` — which are the END USER's, so the
 *      flow authorizes as the human's actor via the policy core. The agent can
 *      never see or do more than the human could.
 * The model only ever NAMES a tool; it cannot add one, change the actor, or
 * reach the DB / shell — the executor's whole surface is `command.run`.
 */
export const runReadOnlyAgentFlow = async <Deps>(
  registry: ReadonlyArray<FlowCommand<Deps>>,
  deps: Deps,
  call: AgentToolCall,
): Promise<Result<unknown, AgentError>> => {
  const command = findFlowCommand(registry, call.name);
  if (!command) {
    return err({
      tag: 'agent/unknown-tool',
      message: `No tool "${call.name}".`,
    });
  }
  if (command.kind !== 'query') {
    return err({
      tag: 'agent/not-read-only',
      message: `Tool "${call.name}" mutates state; the read-only executor refuses it.`,
    });
  }
  const parsed = command.input.safeParse(call.input);
  if (!parsed.success) {
    return err({
      tag: 'agent/invalid-input',
      message: `Invalid arguments for "${call.name}".`,
    });
  }
  return command.run(deps, parsed.data);
};

/**
 * One line of the agent's non-bypassable trail (control G of the blueprint):
 * WHO (a stable ref to the human — never the model), WHAT tool they asked for,
 * whether it RAN or was REFUSED (+ the refusal tag), and WHEN. Even a refused
 * mutation — the model naming `org.block` — is recorded, so a hijack attempt is
 * visible after the fact.
 */
export type AgentAuditEvent = {
  readonly actorRef: string;
  readonly tool: string;
  readonly outcome: 'ran' | 'refused';
  readonly reason: string | null;
  readonly occurredAt: string;
};

export type AgentAuditSink = {
  readonly record: (event: AgentAuditEvent) => Promise<void>;
};

export type AuditedAgentContext = {
  readonly audit: AgentAuditSink;
  readonly clock: Clock;
  /** A stable ref to the HUMAN behind the turn (e.g. their membership id). */
  readonly actorRef: string;
};

/**
 * `runReadOnlyAgentFlow` wrapped so EVERY call is audited — allowed or refused.
 * The composition root exposes only this to the agent, so there is no path to
 * run a tool without leaving a record. The result is unchanged; the audit is a
 * side effect that always fires.
 */
export const runAuditedAgentFlow = async <Deps>(
  ctx: AuditedAgentContext,
  registry: ReadonlyArray<FlowCommand<Deps>>,
  deps: Deps,
  call: AgentToolCall,
): Promise<Result<unknown, AgentError>> => {
  const result = await runReadOnlyAgentFlow(registry, deps, call);
  await ctx.audit.record({
    actorRef: ctx.actorRef,
    tool: call.name,
    outcome: result.ok ? 'ran' : 'refused',
    reason: result.ok ? null : result.error.tag,
    occurredAt: ctx.clock.now().toISOString(),
  });
  return result;
};
