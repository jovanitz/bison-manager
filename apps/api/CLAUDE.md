# apps/api — `layer:app` (composition root)

HTTP API target (Hono on Node). **May import every layer** — like the other
apps, this is a composition root.

- **Job:** [src/composition-root.ts](src/composition-root.ts) wires adapters
  (explicit DI by parameters — no container) and [src/app.ts](src/app.ts)
  assembles the Hono router; [src/main.ts](src/main.ts) boots the Node server
  with the phase-3 seeded world ([src/seed.ts](src/seed.ts) —
  `Authorization: Bearer session-<preset>`, preset = owner|support|customer).
- **The pipeline:** every capability is one `ApiProcedure`
  ([src/procedure.ts](src/procedure.ts)) declared in the registry
  ([src/procedures/](src/procedures/)) — name + zod schema + required action +
  use-case handler; every access use case is declared there.
  [src/rpc-routes.ts](src/rpc-routes.ts) generates `POST /rpc/<name>` routes:
  actor middleware ([src/actor-middleware.ts](src/actor-middleware.ts), 401
  fail-closed) → zod parse (400) → handler → `Result`-tag → HTTP
  (`statusForErrorTag`). To add an endpoint you only declare a procedure;
  never hand-write a route.
- **Testing:** route tests hit the app in-memory via `app.request(...)` — no
  listening socket, no supertest. Contract tests: pipeline in
  [src/rpc.spec.ts](src/rpc.spec.ts), per-endpoint in
  [src/rpc-admin.spec.ts](src/rpc-admin.spec.ts) and
  [src/rpc-impersonation.spec.ts](src/rpc-impersonation.spec.ts), sharing
  [src/testing/rpc-harness.ts](src/testing/rpc-harness.ts).
- **Forbidden:** business logic, persistence details, or auth rules in route
  handlers. Logic lives in `application`/`domain`; this app only wires and
  translates HTTP ⇄ use cases.

Targets: `nx serve api` (tsx watch) · `nx test api` (vitest, inferred) ·
`nx lint api` · `nx typecheck api`.
