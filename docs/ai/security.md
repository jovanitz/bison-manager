# AI context — Security (sensitive features)

Read this **before** building anything that handles identity, secrets, or trust:
authentication, sessions, tokens, passwords, permissions/authorization, payments.
The architecture's `Result`-everywhere, ports-as-types, and boundary rules already
help; this adds the security-specific controls.

> This page is the **build rules**. For how the existing auth/access model
> actually works (identity vs authorization, the actor, the request pipeline,
> scopes, multi-org, grants, invitations, soft-block vs hard-disable, root
> protection), read [auth.md](auth.md) first.

## Where security-sensitive code goes (same layering)

- **Rules** (token expiry, password policy, permission checks) → `domain`
  (pure, deterministic, unit-tested).
- **Orchestration** (login flow, refresh) → `application` use cases behind a
  **port type** (e.g. `AuthProvider`, already in `libs/application/src/ports/auth.ts`).
- **Provider/transport** (JWT, Cognito/Auth0/Clerk, HTTP) → `infrastructure`
  adapters; swapped only in `apps/*/composition-root.ts`.
- **Secret storage** → the `platform` `secureStorage` port — never `localStorage`
  in business code.

## Hard rules (in addition to constraints.md)

1. **Never log secrets.** No tokens, passwords, or PII in `logger` calls or errors.
2. **Secrets only via ports.** Read/write tokens through `platform.secureStorage`,
   never `window`/`localStorage`/`document.cookie` directly (and never in
   `domain`/`application`).
3. **No secrets in the bundle or VCS.** Config comes from env at the composition
   root; check `pnpm harness perf` output doesn't ship a key.
4. **Validate at the boundary.** Parse/validate all external input (Zod at the
   adapter/UI edge) before it reaches a use case; return `Result`, never throw.
5. **Authorization is a domain rule, not a UI concern.** The UI may hide a button,
   but the permission check must live in `domain`/`application` and be tested.
6. **Fail closed.** On an auth/permission error, deny by default.

## Workflow for a sensitive feature

1. Build it **by hand** (not `generate-feature` — it's CRUD-only). Port type first,
   per [workflow.md](workflow.md).
2. Add **headless specs** for the rules and the failure paths (expired token,
   wrong password, missing permission).
3. Run the gate: `pnpm harness quality` (and `gaps`).
4. **Run `/security-review`** on the diff before merging. Treat it as a required
   sensor for anything in this doc's scope.

> `/security-review` is an _inferential_ sensor (AI semantic review). The harness's
> other sensors are computational and won't catch logic-level auth flaws — this
> one is the gap-filler for sensitive work. See [harness.md](harness.md).

## Automated security sensors (three complementary layers)

| Layer                 | Sensor                           | Covers                                                                          |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| App-code logic        | `/security-review` (inferential) | auth/permission flaws in your code                                              |
| Software supply chain | `pnpm harness audit`             | known CVEs in dependencies (OSV)                                                |
| Agent surface         | `pnpm harness skill-scan`        | malicious/vulnerable skills & MCP (NVIDIA SkillSpector; skips if not installed) |

`audit` and `skill-scan` run **advisory** in CI today (a security baseline). Once
the dependency tree is clean, promote `audit` to blocking on `--level=high`. Run
`skill-scan` before trusting any **third-party** skill or MCP server.

## Caller-agnostic operations (the AI-execution surface)

We are heading toward an AI that runs user-permitted actions via prompts, driving
the **same** registry flows the UI drives (`libs/application/src/flows/agent-executor.ts`).
For that to be safe, a mutation must not depend on _who_ called it: its
authorization and its audited **reason** live in the flow contract, never
synthesized by a caller. The `operations` sensor (`pnpm harness operations`,
**blocking**) enforces this. Read [operations.md](operations.md) before wiring any
mutating lever.
