# Caller-agnostic operations

A mutating operation must be **indifferent to who calls it** — a human through
the UI or an AI through a prompt. Its logic, authorization and **audit** live in
the flow contract (`libs/application`), not in the adapter. The UI and a
prompt-driven agent are two thin adapters over the _same_ operation.

The load-bearing corollary:

> The audited **intent** of a mutation — its `reason` — is a **required field of
> the operation's input contract**, and no caller (UI / adapter) may **originate**
> it.

## Why

We are heading toward an AI that executes user-permitted actions via prompts
(see [security.md](security.md), `libs/application/src/flows/agent-executor.ts`).
That agent runs the **same** registry flows the UI runs: it validates args with
the flow's own Zod schema, authorizes as the human's actor, and audits every
call. For that to be safe, an operation cannot depend on _where_ its inputs came
from. The `reason` is an input like any other:

- **Human** → types it into a required field (the dialog blocks on empty).
- **AI** → derives it from the prompt (_"retire the summer plan, we launched 2027"_
  → `reason: "we launched 2027"`).

Both feed the identical schema → use case → audit event. If the UI **synthesized**
the reason (a hardcoded `reason: "Retired via console"`), the agent — which never
passes through the UI — would either fail or invent its own, and the audit trail
would be a lie. That synthesis is exactly the coupling this rule forbids.

## The two rules (enforced by `pnpm harness operations`, a blocking gate)

- **A — no synthesized reasons in callers.** In `libs/ui` + the client apps, a
  `reason:` assigned a **string literal** is a violation. The reason must be a
  real caller argument. _(The API is excluded — it seeds a demo world
  server-side, where authoring reasons is legitimate.)_
- **C — reason-bearing contract.** In the flow input schemas
  (`libs/application/src/flows/**`), a Zod `reason` field must be
  `z.string().min(1)` and **not** `.optional()` — required and non-empty, so the
  audit can never be silently loosened. Most levers use the shared
  `const reason = z.string().min(1).max(500)`.

## Wiring a new lever — the checklist

1. Add the `command` flow with `reason` in its Zod input (reuse the shared
   `reason`), so it is enumerable + AI-reachable in the registry
   (`DASHBOARD_FLOWS` / `BILLING_FLOWS`).
2. Collect the reason from the caller: a **required field/step** in the UI
   (block submit while empty), like the Plans edit / retire / reset / set-default
   dialogs. Never a constant.
3. The store/container passes the reason **through** as an argument — it never
   builds it.

Reference implementation: the Plans screen
([libs/ui/src/medicine-manager/dashboard/plans](../../libs/ui/src/medicine-manager/dashboard/plans),
[registry-inputs.ts](../../libs/application/src/flows/dashboard/registry-inputs.ts)).

## Escape hatches (rare, self-documenting)

Put the marker on the offending line, with a justification:

- `// harness:reason-literal-ok <why>` — a `reason` field that is genuinely not
  an audited operation's reason (Rule A).
- `// harness:reason-optional-ok <why>` — a lever whose reason is optional by
  deliberate design (Rule C). Today's only carve-out: `adminAccountInput` — the
  account-admin levers don't yet capture a reason; revisit when they do.
