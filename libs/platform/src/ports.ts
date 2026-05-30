import type { Result } from '@acme/shared';

/**
 * Platform capability ports.
 *
 * These abstract the device features that differ across web, iOS, Android,
 * Windows and macOS. Each is a plain type; the browser/Capacitor/Tauri adapters
 * implement them. The application receives the `Platform` aggregate through its
 * composition root, so a use case that needs the camera depends on `Camera`,
 * never on `@capacitor/camera` or a Tauri command.
 */

export type PlatformError = {
  readonly tag: 'platform/unavailable' | 'platform/denied' | 'platform/error';
  readonly message: string;
};

export type NetworkState = {
  readonly online: boolean;
  readonly connectionType:
    | 'wifi'
    | 'cellular'
    | 'ethernet'
    | 'none'
    | 'unknown';
};

export type NetworkStatus = {
  readonly current: () => Promise<NetworkState>;
  readonly subscribe: (listener: (state: NetworkState) => void) => () => void;
};

export type SecureStorage = {
  readonly get: (key: string) => Promise<string | null>;
  readonly set: (key: string, value: string) => Promise<void>;
  readonly remove: (key: string) => Promise<void>;
};

export type CapturedPhoto = {
  readonly dataUrl: string;
  readonly format: string;
};

export type Camera = {
  readonly capture: () => Promise<Result<CapturedPhoto, PlatformError>>;
};

export type Notifications = {
  readonly requestPermission: () => Promise<boolean>;
  readonly notify: (input: {
    title: string;
    body: string;
  }) => Promise<Result<void, PlatformError>>;
};

export type FileSystem = {
  readonly readText: (path: string) => Promise<Result<string, PlatformError>>;
  readonly writeText: (
    path: string,
    contents: string,
  ) => Promise<Result<void, PlatformError>>;
};

export type Printer = {
  readonly print: (input: {
    html: string;
  }) => Promise<Result<void, PlatformError>>;
};

export type BarcodeScanner = {
  readonly scan: () => Promise<Result<string, PlatformError>>;
};

export type DeviceInfo = {
  readonly platform: 'web' | 'ios' | 'android' | 'windows' | 'macos';
  readonly appVersion: string;
  readonly model: string | null;
};

/**
 * The aggregate of every capability. The composition root assembles one of
 * these per platform and injects it. A capability a given platform cannot
 * provide returns a `platform/unavailable` error rather than being absent, so
 * call sites stay uniform.
 */
export type Platform = {
  readonly network: NetworkStatus;
  readonly secureStorage: SecureStorage;
  readonly camera: Camera;
  readonly notifications: Notifications;
  readonly fileSystem: FileSystem;
  readonly printer: Printer;
  readonly barcode: BarcodeScanner;
  readonly device: () => Promise<DeviceInfo>;
};
