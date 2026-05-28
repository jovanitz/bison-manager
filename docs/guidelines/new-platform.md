# Guideline: Adding a new platform

Because business logic, use cases and UI are platform-independent, a new platform
is **a new platform adapter + a new composition root** — not a new application.

## Steps

1. **Implement the `Platform` port** (`libs/platform/src/<platform>/`).
   - Provide a `create<Platform>Platform(...)` factory returning the `Platform`
     aggregate (network, secureStorage, camera, notifications, fileSystem,
     printer, barcode, device).
   - **Inject native SDKs, don't import them** into the library (see the
     Capacitor/Tauri adapters): accept the SDK slice as a typed parameter so the
     `platform` lib stays free of native deps and keeps compiling in CI.
   - Capabilities the platform can't provide should return
     `platform/unavailable` rather than be omitted, so call sites stay uniform.
   - Reuse `createBrowserPlatform` as a base if the platform runs a WebView, then
     override the capabilities that are genuinely native.

2. **Create the app** (`apps/<platform>/`).
   - `project.json` tagged `layer:app`, tsconfig, Vite config, `index.html`.
   - A `native-*.ts` module that is the *only* place importing the native SDK
     (real imports go here once installed; ship a typed stub for CI).
   - A **composition root** that mirrors `apps/web` but swaps in your platform
     adapter. Persistence/sync/auth/use-case wiring should be identical.
   - A thin `main.tsx` that builds the runtime and renders the shared UI.

3. **Add tests** (optional) using a fake of the new platform (see
   `libs/platform/src/fake`) so the platform-specific behaviour can be exercised
   without a device.

4. **Boundaries & CI**: confirm the new app is tagged `layer:app`, add it to the
   root `tsconfig.json` references, and ensure `nx affected` picks it up.

## What you should NOT do

- Do not fork feature screens or use cases per platform.
- Do not put `if (platform === 'ios')` branches in `ui`/`application`/`domain`.
  Platform differences belong in the platform adapter and composition root only.
