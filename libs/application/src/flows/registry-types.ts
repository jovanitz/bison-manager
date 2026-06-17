import type { z } from 'zod';
import type { Result } from '@acme/shared';

/**
 * The shape of an ENUMERABLE flow command. Each entry pairs a stable name with
 * a Zod input schema and a `run(deps, input)` thunk. A future MCP server
 * iterates a registry of these to expose one tool per entry: it reads `name` +
 * `kind`, derives a JSON schema from `input`, validates the caller's payload
 * with `input.parse`, and invokes `run`. The UI stores call the typed
 * controller functions directly — the registry exists purely to make the same
 * flows machine-discoverable.
 *
 * `run` is typed loosely (`unknown` in/out) because a registry is heterogeneous;
 * per-command type safety lives in the controller functions, and each entry
 * parses with its schema before delegating.
 */
export type FlowCommandKind = 'query' | 'command';

export type FlowCommand<Deps> = {
  readonly name: string;
  readonly kind: FlowCommandKind;
  readonly description: string;
  readonly input: z.ZodTypeAny;
  readonly run: (
    deps: Deps,
    input: unknown,
  ) => Promise<
    Result<unknown, { readonly tag: string; readonly message: string }>
  >;
};

/** Look up a command by its stable name (what an MCP dispatcher does). */
export const findFlowCommand = <Deps>(
  registry: ReadonlyArray<FlowCommand<Deps>>,
  name: string,
): FlowCommand<Deps> | undefined => registry.find((c) => c.name === name);
