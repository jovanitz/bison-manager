import { type Result, err, ok } from '@acme/shared';
import type { NetworkState, Platform, PlatformError } from '../ports';

/**
 * A fully in-memory, scriptable `Platform` for tests.
 *
 * Crucially it exposes `setOnline()` so a test can *simulate offline mode* at
 * the flick of a switch — no network conditions, no native device required.
 */
export type FakePlatform = Platform & {
  readonly setOnline: (online: boolean) => void;
};

export const createFakePlatform = (
  initial: Partial<NetworkState> = {},
): FakePlatform => {
  const secrets = new Map<string, string>();
  let state: NetworkState = {
    online: initial.online ?? true,
    connectionType: initial.connectionType ?? 'wifi',
  };
  const listeners = new Set<(s: NetworkState) => void>();

  const denied = (what: string): Result<never, PlatformError> =>
    err({ tag: 'platform/unavailable', message: `${what} not available in fake platform.` });

  return {
    setOnline: (online: boolean) => {
      state = { online, connectionType: online ? 'wifi' : 'none' };
      for (const l of listeners) l(state);
    },
    network: {
      current: async () => state,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    secureStorage: {
      get: async (key) => secrets.get(key) ?? null,
      set: async (key, value) => {
        secrets.set(key, value);
      },
      remove: async (key) => {
        secrets.delete(key);
      },
    },
    camera: { capture: async () => denied('Camera') },
    notifications: {
      requestPermission: async () => true,
      notify: async () => ok(undefined),
    },
    fileSystem: {
      readText: async () => denied('File system'),
      writeText: async () => ok(undefined),
    },
    printer: { print: async () => ok(undefined) },
    barcode: { scan: async () => ok('0000000000000') },
    device: async () => ({ platform: 'web', appVersion: 'test', model: 'fake' }),
  };
};
