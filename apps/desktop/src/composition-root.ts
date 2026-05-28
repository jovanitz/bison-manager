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
import { createTauriPlatform, type Platform, type TauriApis } from '@acme/platform';
import type { AppUseCases } from '@acme/ui';

/**
 * The DESKTOP composition root.
 *
 * Identical wiring to web/mobile except the platform adapter is
 * `createTauriPlatform`. Persistence still uses Dexie (Tauri runs a WebView, so
 * IndexedDB is available); secrets and the file system go through the injected
 * Tauri APIs. This is the payoff of hexagonal architecture: a new platform is a
 * new composition root, not a new application.
 */
export type DesktopRuntime = {
  readonly useCases: AppUseCases;
  readonly platform: Platform;
  readonly sync: () => Promise<void>;
};

export const createDesktopRuntime = (config: {
  apiBaseUrl: string;
  apis: TauriApis;
}): DesktopRuntime => {
  const logger = createConsoleLogger({ app: 'desktop' });
  const platform = createTauriPlatform(config.apis);

  const db = createDatabase('acme-desktop');
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
