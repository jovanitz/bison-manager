import { type Result, err, ok } from '@acme/shared';
import { createBrowserPlatform } from '../browser/browser-platform';
import type {
  Camera,
  DeviceInfo,
  NetworkState,
  NetworkStatus,
  Platform,
  PlatformError,
  SecureStorage,
} from '../ports';

/**
 * Capacitor adapter for iOS and Android.
 *
 * The native plugins are *injected* (see `CapacitorPlugins`) rather than
 * imported directly, for two reasons:
 *   1. This library stays free of a hard `@capacitor/*` dependency, so it builds
 *      and typechecks in CI without native toolchains.
 *   2. It keeps dependencies explicit — the mobile composition root performs the
 *      real imports and passes them in:
 *
 *        import { Network } from '@capacitor/network';
 *        import { Preferences } from '@capacitor/preferences';
 *        import { Camera, CameraResultType } from '@capacitor/camera';
 *        import { Device } from '@capacitor/device';
 *        createCapacitorPlatform({ Network, Preferences, Camera, Device, ... });
 *
 * Capabilities Capacitor does not provide here fall back to the browser
 * implementation, since Capacitor apps run a WebView.
 */
export type CapacitorPlugins = {
  readonly Network: {
    getStatus: () => Promise<{ connected: boolean; connectionType: string }>;
    addListener: (
      event: 'networkStatusChange',
      cb: (status: { connected: boolean; connectionType: string }) => void,
    ) => Promise<{ remove: () => void }>;
  };
  readonly Preferences: {
    get: (opts: { key: string }) => Promise<{ value: string | null }>;
    set: (opts: { key: string; value: string }) => Promise<void>;
    remove: (opts: { key: string }) => Promise<void>;
  };
  readonly Camera: {
    getPhoto: (opts: {
      resultType: 'dataUrl';
      quality?: number;
    }) => Promise<{ dataUrl?: string; format: string }>;
  };
  readonly Device: {
    getInfo: () => Promise<{
      platform: string;
      appVersion?: string;
      model: string;
    }>;
  };
};

const mapConnectionType = (raw: string): NetworkState['connectionType'] => {
  switch (raw) {
    case 'wifi':
    case 'cellular':
    case 'ethernet':
    case 'none':
      return raw;
    default:
      return 'unknown';
  }
};

const capacitorNetwork = (
  Network: CapacitorPlugins['Network'],
): NetworkStatus => ({
  current: async (): Promise<NetworkState> => {
    const status = await Network.getStatus();
    return {
      online: status.connected,
      connectionType: mapConnectionType(status.connectionType),
    };
  },
  subscribe: (listener) => {
    const handle = Network.addListener('networkStatusChange', (status) =>
      listener({
        online: status.connected,
        connectionType: mapConnectionType(status.connectionType),
      }),
    );
    return () => {
      void handle.then((h) => h.remove());
    };
  },
});

const capacitorSecureStorage = (
  Preferences: CapacitorPlugins['Preferences'],
): SecureStorage => ({
  get: async (key) => (await Preferences.get({ key })).value,
  set: async (key, value) => Preferences.set({ key, value }),
  remove: async (key) => Preferences.remove({ key }),
});

const capacitorCamera = (CameraPlugin: CapacitorPlugins['Camera']): Camera => ({
  capture: async (): Promise<
    Result<{ dataUrl: string; format: string }, PlatformError>
  > => {
    try {
      const photo = await CameraPlugin.getPhoto({
        resultType: 'dataUrl',
        quality: 80,
      });
      if (!photo.dataUrl) {
        return err({ tag: 'platform/error', message: 'No image captured.' });
      }
      return ok({ dataUrl: photo.dataUrl, format: photo.format });
    } catch (cause) {
      return err({
        tag: 'platform/denied',
        message: 'Camera capture failed.',
        ...(cause ? {} : {}),
      });
    }
  },
});

export const createCapacitorPlatform = (
  plugins: CapacitorPlugins,
  appVersion = '0.0.0',
): Platform => {
  const base = createBrowserPlatform(appVersion);
  return {
    ...base,
    network: capacitorNetwork(plugins.Network),
    secureStorage: capacitorSecureStorage(plugins.Preferences),
    camera: capacitorCamera(plugins.Camera),
    device: async (): Promise<DeviceInfo> => {
      const info = await plugins.Device.getInfo();
      const platform =
        info.platform === 'ios' || info.platform === 'android'
          ? info.platform
          : 'web';
      return {
        platform,
        appVersion: info.appVersion ?? appVersion,
        model: info.model,
      };
    },
  };
};
