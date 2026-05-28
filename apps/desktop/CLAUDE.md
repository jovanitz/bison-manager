# apps/desktop — `layer:app` (composition root)

Windows + macOS target. Tauri wraps the web build. **May import every layer.**

- **Job:** [src/composition-root.ts](src/composition-root.ts) wires the **Tauri**
  platform adapter (and the shared infrastructure adapters) into the use cases,
  then hands them to the UI via `UseCasesProvider`.
- **Native imports stay isolated** in [src/native-apis.ts](src/native-apis.ts)
  (stubbed for CI). Don't import Tauri anywhere else.
- **Forbidden:** business logic or adapter internals here — the root only wires.

Mirrors [apps/web](../web/CLAUDE.md). Adding/another platform:
[new-platform.md](../../docs/guidelines/new-platform.md).
