import {
  createConsoleLogger,
  systemClock,
  uuidGenerator,
  type Logger,
} from '@acme/shared';
import {
  makeAccessClientUseCases,
  makeInvitationsUseCases,
  makeItemUseCases,
  makeMembersUseCases,
  makeOrgsUseCases,
  nullEventPublisher,
} from '@acme/application';
import {
  createHttpApiClient,
  createInMemoryItemRepository,
  createRpcAccessGateway,
  createRpcActivationGateway,
  createRpcInvitationsGateway,
  createRpcMembersGateway,
  createRpcOrgsGateway,
  createRpcRolesGateway,
  createSupabaseAuthProvider,
} from '@acme/infrastructure';
import { createBrowserPlatform, type Platform } from '@acme/platform';
import type { AppUseCases } from '@acme/ui';

/**
 * The CLIENT (customer) app composition root — the only place this app wires
 * concrete adapters. Online-only and self-serve: identity via Supabase
 * (signup ON — a new account lands in its own org), plus the access + orgs
 * gateways over the API. The `items` bundle is an unused stub so the shared
 * `AppUseCases` contract holds.
 */
export type ClientRuntime = {
  readonly useCases: AppUseCases;
  readonly platform: Platform;
  readonly logger: Logger;
};

export const createClientRuntime = (config: {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}): ClientRuntime => {
  const logger = createConsoleLogger({ app: 'client' });
  const platform = createBrowserPlatform(
    import.meta.env['VITE_APP_VERSION'] ?? '0.0.0',
  );

  const auth = createSupabaseAuthProvider({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    storage: {
      get: () => platform.secureStorage.get('session'),
      set: (v) =>
        v
          ? platform.secureStorage.set('session', v)
          : platform.secureStorage.remove('session'),
    },
  });

  const api = createHttpApiClient({ baseUrl: config.apiBaseUrl, auth });
  const access = makeAccessClientUseCases({
    auth,
    gateway: createRpcAccessGateway({ api }),
  });
  const orgs = makeOrgsUseCases({ gateway: createRpcOrgsGateway({ api }) });
  const invitations = makeInvitationsUseCases({
    invitations: createRpcInvitationsGateway({ api }),
    activation: createRpcActivationGateway({ baseUrl: config.apiBaseUrl }),
  });
  const members = makeMembersUseCases({
    gateway: createRpcMembersGateway({ api }),
  });
  const roles = createRpcRolesGateway({ api });

  const items = makeItemUseCases({
    repository: createInMemoryItemRepository(),
    clock: systemClock,
    ids: uuidGenerator,
    events: nullEventPublisher,
    logger,
  });

  return {
    useCases: { items, access, orgs, invitations, members, roles },
    platform,
    logger,
  };
};
