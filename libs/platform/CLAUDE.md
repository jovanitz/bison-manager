# libs/platform — `layer:platform`

Adapters that implement `application` ports for **device capabilities**.
**May import `application`, `domain`, `shared`.**

- **Holds:** browser / Capacitor / Tauri / fake platform adapters
  (`src/{browser,capacitor,tauri,fake}`).
- **Forbidden:** `infrastructure`, `ui`. Native imports (Capacitor/Tauri) stay
  isolated to their adapter file — don't scatter them.
- **Pattern:**
  - A platform port is a `type` in `application`; each environment provides a
    **factory-function adapter** (`createBrowserPlatform`, `createTauriPlatform`,
    …) plus a `fake` for tests.
  - Prove adapters against the shared contract test; `nx test platform`.

Examples: [src/capacitor/capacitor-platform.ts](src/capacitor/capacitor-platform.ts) ·
[src/tauri/tauri-platform.ts](src/tauri/tauri-platform.ts) ·
[src/fake](src/fake). Adding an environment: [new-platform.md](../../docs/guidelines/new-platform.md).
