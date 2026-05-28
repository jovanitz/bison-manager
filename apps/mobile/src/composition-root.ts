import {
  createConsoleLogger,
  systemClock,
  uuidGenerator,
} from '@acme/shared';
import { makeItemUseCases, nullEventPublisher } from '@acme/application';
import {
  createApiItemRepository,
  createDexieItemRepository,
  createDexieOperationQueue,
  createDatabase,
  createHttpApiClient,
  createJwtAuthProvider,
  createOfflineItemRepository,
  createSyncEngine,
} from '@acme/infrastructure';
import { createCapacitorPlatform, type Platform } from '@acme/platform';
import type { AppUseCases } from '@acme/ui';

// The real Capacitor plugin imports happen HERE, in the composition root, and
// are injected into the platform adapter. The platform library itself stays
// free of @capacitor/* dependencies.
//
//   import { Network } from '@capacitor/network';
//   import { Preferences } from '@capacitor/preferences';
//   import { Camera } from '@capacitor/camera';
//   import { Device } from '@capacitor/device';
//
// They are passed as `plugins` below. For brevity the type is `CapacitorPlugins`.
import type { CapacitorPlugins } from '@acme/platform';

/**
 * The MOBILE composition root.
 *
 * Compare it to apps/web: the ONLY material difference is the platform adapter
 * (`createCapacitorPlatform` instead of `createBrowserPlatform`). The
 * persistence, sync, auth and use-case wiring are identical, which is exactly
 * the "minimal platform-specific code" goal.
 */
export type MobileRuntime = {
  readonly useCases: AppUseCases;
  readonly platform: Platform;
  readonly sync: () => Promise<void>;
};

export const createMobileRuntime = (config: {
  apiBaseUrl: string;
  plugins: CapacitorPlugins;
}): MobileRuntime => {
  const logger = createConsoleLogger({ app: 'mobile' });
  const platform = createCapacitorPlatform(config.plugins);

  const db = createDatabase('acme-mobile');
  const local = createDexieItemRepository(db);
  const queue = createDexieOperationQueue(db);
  const repository = createOfflineItemRepository({
    local,
    queue,
    clock: systemClock,
    ids: uuidGenerator,
  });

  const auth = createJwtAuthProvider({
    api: createHttpApiClient({ baseUrl: config.apiBaseUrl }),
    storage: {
      get: () => platform.secureStorage.get('session'),
      set: (v) =>
        v
          ? platform.secureStorage.set('session', v)
          : platform.secureStorage.remove('session'),
    },
  });
  const api = createHttpApiClient({ baseUrl: config.apiBaseUrl, auth });
  const remote = createApiItemRepository(api);
  const engine = createSyncEngine({ queue, local, remote, logger });

  platform.network.subscribe((s) => {
    if (s.online) void engine.runOnce();
  });

  return {
    useCases: {
      items: makeItemUseCases({
        repository,
        clock: systemClock,
        ids: uuidGenerator,
        events: nullEventPublisher,
        logger,
      }),
    },
    platform,
    sync: async () => {
      await engine.runOnce();
    },
  };
};
