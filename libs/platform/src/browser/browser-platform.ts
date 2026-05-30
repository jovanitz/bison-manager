import { type Result, err, ok } from '@acme/shared';
import type {
  BarcodeScanner,
  Camera,
  DeviceInfo,
  FileSystem,
  NetworkState,
  NetworkStatus,
  Notifications,
  Platform,
  PlatformError,
  Printer,
  SecureStorage,
} from '../ports';

/** Browser/PWA implementation of every platform capability. */

const unavailable = (what: string): Result<never, PlatformError> =>
  err({
    tag: 'platform/unavailable',
    message: `${what} is unavailable in the browser.`,
  });

const browserNetwork = (): NetworkStatus => ({
  current: async (): Promise<NetworkState> => ({
    online: navigator.onLine,
    connectionType: navigator.onLine ? 'unknown' : 'none',
  }),
  subscribe: (listener) => {
    const update = () =>
      listener({
        online: navigator.onLine,
        connectionType: navigator.onLine ? 'unknown' : 'none',
      });
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  },
});

// Note: localStorage is *not* truly secure; on web this is the pragmatic option.
// The Capacitor/Tauri adapters use the OS keychain/secure store instead.
const browserSecureStorage = (): SecureStorage => ({
  get: async (key) => localStorage.getItem(key),
  set: async (key, value) => localStorage.setItem(key, value),
  remove: async (key) => localStorage.removeItem(key),
});

const browserCamera = (): Camera => ({
  capture: async () => unavailable('Native camera'),
});

const browserNotifications = (): Notifications => ({
  requestPermission: async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },
  notify: async ({ title, body }) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return err({
        tag: 'platform/denied',
        message: 'Notifications not granted.',
      });
    }
    new Notification(title, { body });
    return ok(undefined);
  },
});

const browserFileSystem = (): FileSystem => ({
  readText: async () => unavailable('File system'),
  writeText: async (_, contents) => {
    // Browser fallback: trigger a download.
    const blob = new Blob([contents], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.txt';
    a.click();
    URL.revokeObjectURL(url);
    return ok(undefined);
  },
});

const browserPrinter = (): Printer => ({
  print: async ({ html }) => {
    const win = window.open('', '_blank');
    if (!win) return err({ tag: 'platform/error', message: 'Popup blocked.' });
    win.document.write(html);
    win.document.close();
    win.print();
    return ok(undefined);
  },
});

const browserBarcode = (): BarcodeScanner => ({
  scan: async () => unavailable('Barcode scanner'),
});

export const createBrowserPlatform = (appVersion = '0.0.0'): Platform => ({
  network: browserNetwork(),
  secureStorage: browserSecureStorage(),
  camera: browserCamera(),
  notifications: browserNotifications(),
  fileSystem: browserFileSystem(),
  printer: browserPrinter(),
  barcode: browserBarcode(),
  device: async (): Promise<DeviceInfo> => ({
    platform: 'web',
    appVersion,
    model: null,
  }),
});
