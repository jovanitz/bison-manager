import type { CapacitorPlugins } from '@acme/platform';

/**
 * The single place that touches the native Capacitor SDK.
 *
 * Once you have installed the plugins (`pnpm add @capacitor/network
 * @capacitor/preferences @capacitor/camera @capacitor/device`), replace the
 * body below with the real imports:
 *
 *   import { Network } from '@capacitor/network';
 *   import { Preferences } from '@capacitor/preferences';
 *   import { Camera } from '@capacitor/camera';
 *   import { Device } from '@capacitor/device';
 *   export const nativePlugins: CapacitorPlugins = { Network, Preferences, Camera, Device };
 *
 * Keeping native imports isolated here is what lets the rest of the app — and CI
 * — compile without the native toolchain present.
 */
export const nativePlugins: CapacitorPlugins = {
  Network: {
    getStatus: async () => ({ connected: true, connectionType: 'wifi' }),
    addListener: async () => ({ remove: () => undefined }),
  },
  Preferences: {
    get: async () => ({ value: null }),
    set: async () => undefined,
    remove: async () => undefined,
  },
  Camera: {
    getPhoto: async () => ({ format: 'jpeg' }),
  },
  Device: {
    getInfo: async () => ({
      platform: 'ios',
      appVersion: '0.0.0',
      model: 'simulator',
    }),
  },
};
