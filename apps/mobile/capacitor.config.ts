import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the built web assets in a native iOS/Android shell. The same
 * Vite bundle that powers `apps/web` is loaded into the WebView; only the
 * composition root differs (it uses the Capacitor platform adapter).
 */
const config: CapacitorConfig = {
  appId: 'com.acme.app',
  appName: 'Acme',
  webDir: '../../dist/apps/mobile',
  server: { androidScheme: 'https' },
};

export default config;
