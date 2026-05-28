import { type Result, err, ok } from '@acme/shared';
import { createBrowserPlatform } from '../browser/browser-platform';
import type {
  DeviceInfo,
  FileSystem,
  Platform,
  PlatformError,
  SecureStorage,
} from '../ports';

/**
 * Tauri adapter for Windows and macOS desktop.
 *
 * As with Capacitor, the Tauri JS APIs are injected so this library has no hard
 * `@tauri-apps/*` dependency. The desktop composition root wires the real ones:
 *
 *   import { invoke } from '@tauri-apps/api/core';
 *   import * as fs from '@tauri-apps/plugin-fs';
 *   import { platform, version } from '@tauri-apps/plugin-os';
 *   import { Store } from '@tauri-apps/plugin-store';
 *   createTauriPlatform({ invoke, fs, os: { platform, version }, store });
 *
 * Secure storage uses the Tauri Store plugin (OS-appropriate, app-scoped file);
 * for true secrets you would back `SecureStorage` with the Stronghold plugin.
 */
export type TauriApis = {
  readonly fs: {
    readTextFile: (path: string) => Promise<string>;
    writeTextFile: (path: string, contents: string) => Promise<void>;
  };
  readonly os: {
    platform: () => Promise<string>;
    version: () => Promise<string>;
  };
  readonly store: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
    save: () => Promise<void>;
  };
};

const tauriSecureStorage = (store: TauriApis['store']): SecureStorage => ({
  get: async (key) => store.get(key),
  set: async (key, value) => {
    await store.set(key, value);
    await store.save();
  },
  remove: async (key) => {
    await store.delete(key);
    await store.save();
  },
});

const tauriFileSystem = (fs: TauriApis['fs']): FileSystem => ({
  readText: async (
    path,
  ): Promise<Result<string, PlatformError>> => {
    try {
      return ok(await fs.readTextFile(path));
    } catch (cause) {
      return err({ tag: 'platform/error', message: `Read failed: ${path}`, cause });
    }
  },
  writeText: async (path, contents): Promise<Result<void, PlatformError>> => {
    try {
      await fs.writeTextFile(path, contents);
      return ok(undefined);
    } catch (cause) {
      return err({ tag: 'platform/error', message: `Write failed: ${path}`, cause });
    }
  },
});

export const createTauriPlatform = (
  apis: TauriApis,
  appVersion = '0.0.0',
): Platform => {
  const base = createBrowserPlatform(appVersion);
  return {
    ...base,
    secureStorage: tauriSecureStorage(apis.store),
    fileSystem: tauriFileSystem(apis.fs),
    device: async (): Promise<DeviceInfo> => {
      const raw = await apis.os.platform();
      const platform = raw === 'windows' ? 'windows' : raw === 'macos' ? 'macos' : 'web';
      return { platform, appVersion, model: raw };
    },
  };
};
