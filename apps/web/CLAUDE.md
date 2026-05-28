# apps/web — `layer:app` (composition root)

Web + PWA target (Vite). **May import every layer** — this is one of the only
places that is allowed to.

- **Job:** the **composition root** ([src/composition-root.ts](src/composition-root.ts))
  wires concrete adapters (Dexie, REST `ApiClient`, browser platform, auth) into
  the use cases and hands them to the UI via `UseCasesProvider`. This is the only
  file that knows all the adapters exist together.
- **Pattern:** explicit DI by parameters — no container. Swap an adapter here, not
  in the inner layers.
- **Forbidden:** putting business logic, I/O details, or adapter internals here.
  The root only *wires*; logic lives in `application`/`domain`.

`mobile` and `desktop` mirror this file with Capacitor/Tauri adapters; native
imports stay isolated in their `native-*.ts`. Rationale:
[ADR-0005](../../docs/adr/0005-composition-roots-no-container.md).
