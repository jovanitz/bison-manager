import type { TauriApis } from '@acme/platform';

/**
 * The single place that touches the Tauri JS API.
 *
 * After installing the plugins (`pnpm add @tauri-apps/api
 * @tauri-apps/plugin-fs @tauri-apps/plugin-os @tauri-apps/plugin-store`),
 * replace the stubs below with the real bindings:
 *
 *   import * as fs from '@tauri-apps/plugin-fs';
 *   import { platform, version } from '@tauri-apps/plugin-os';
 *   import { Store } from '@tauri-apps/plugin-store';
 *   const store = await Store.load('settings.json');
 *   export const tauriApis: TauriApis = { fs, os: { platform, version }, store: { ... } };
 *
 * Isolating native imports here keeps the rest of the app compiling in CI.
 */
export const tauriApis: TauriApis = {
  fs: {
    readTextFile: async () => '',
    writeTextFile: async () => undefined,
  },
  os: {
    platform: async () => 'macos',
    version: async () => '0.0.0',
  },
  store: {
    get: async () => null,
    set: async () => undefined,
    delete: async () => undefined,
    save: async () => undefined,
  },
};
