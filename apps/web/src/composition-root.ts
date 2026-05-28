import {
  createConsoleLogger,
  systemClock,
  uuidGenerator,
  type Logger,
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
import { createBrowserPlatform, type Platform } from '@acme/platform';
import type { AppUseCases } from '@acme/ui';

/**
 * The WEB composition root.
 *
 * This is the *only* place in the web app where concrete adapters are chosen and
 * wired. Everything above it (UI) and below it (use cases, domain) depends on
 * abstractions. To change persistence, auth provider, or API transport, you edit
 * this file alone. Notice there is no DI container, no decorators, no reflection
 * — just functions calling functions with explicit arguments.
 */
export type WebRuntime = {
  readonly useCases: AppUseCases;
  readonly platform: Platform;
  readonly logger: Logger;
  /** Drain the offline outbox to the server (call on online / interval). */
  readonly sync: () => Promise<void>;
};

export const createWebRuntime = (config: {
  apiBaseUrl: string;
}): WebRuntime => {
  const logger = createConsoleLogger({ app: 'web' });
  const platform = createBrowserPlatform(
    import.meta.env['VITE_APP_VERSION'] ?? '0.0.0',
  );

  // --- Persistence (offline-first): local Dexie store + durable outbox.
  const db = createDatabase('acme-web');
  const localRepo = createDexieItemRepository(db);
  const queue = createDexieOperationQueue(db);
  const repository = createOfflineItemRepository({
    local: localRepo,
    queue,
    clock: systemClock,
    ids: uuidGenerator,
  });

  // --- Auth (provider-agnostic): swap createJwtAuthProvider for Cognito/Auth0/Clerk.
  const apiForAuth = createHttpApiClient({ baseUrl: config.apiBaseUrl });
  const auth = createJwtAuthProvider({
    api: apiForAuth,
    storage: {
      get: () => platform.secureStorage.get('session'),
      set: (v) =>
        v
          ? platform.secureStorage.set('session', v)
          : platform.secureStorage.remove('session'),
    },
  });

  // --- API transport + remote repository (server of record for sync).
  const api = createHttpApiClient({ baseUrl: config.apiBaseUrl, auth });
  const remoteRepo = createApiItemRepository(api);

  // --- Sync engine: replays the outbox to the server.
  const syncEngine = createSyncEngine({
    queue,
    local: localRepo,
    remote: remoteRepo,
    logger,
  });

  // --- Use cases: built once from the wired dependencies.
  const items = makeItemUseCases({
    repository,
    clock: systemClock,
    ids: uuidGenerator,
    events: nullEventPublisher,
    logger,
  });

  // Sync whenever the network comes back.
  platform.network.subscribe((state) => {
    if (state.online) void syncEngine.runOnce();
  });

  return {
    useCases: { items },
    platform,
    logger,
    sync: async () => {
      await syncEngine.runOnce();
    },
  };
};
