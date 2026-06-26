import {
  createConsoleLogger,
  systemClock,
  uuidGenerator,
  type Logger,
} from '@acme/shared';
import {
  makeAccessClientUseCases,
  makeBlockUseCases,
  makeDirectoryUseCases,
  makeInvitationsUseCases,
  makeItemUseCases,
  makeMembersUseCases,
  nullEventPublisher,
} from '@acme/application';
import {
  createHttpApiClient,
  createInMemoryItemRepository,
  createRpcAccessGateway,
  createRpcAccountAdminGateway,
  createRpcAuditGateway,
  createRpcSessionsGateway,
  createRpcSettingsGateway,
  createRpcActivationGateway,
  createRpcBlockGateway,
  createRpcDirectoryGateway,
  createRpcInvitationsGateway,
  createRpcMembersGateway,
  createRpcRolesGateway,
  createSupabaseAuthProvider,
} from '@acme/infrastructure';
import { createBrowserPlatform, type Platform } from '@acme/platform';
import type { AppUseCases } from '@acme/ui';

/**
 * The STAFF DASHBOARD composition root — the only place this app wires concrete
 * adapters. Unlike the web app it is online-only and staff-facing: no offline
 * Dexie store, no sync engine. It needs just three things — identity (Supabase),
 * an API transport, and the access + directory gateways over it. The `items`
 * bundle is an unused in-memory stub so the shared `AppUseCases` contract holds;
 * the dashboard never renders item screens.
 */
export type DashboardRuntime = {
  readonly useCases: AppUseCases;
  readonly platform: Platform;
  readonly logger: Logger;
};

export const createDashboardRuntime = (config: {
  apiBaseUrl: string;
  supabaseUrl: string;
  /** Public (anon/publishable) key — not a secret; the API enforces access. */
  supabaseAnonKey: string;
}): DashboardRuntime => {
  const logger = createConsoleLogger({ app: 'dashboard' });
  const platform = createBrowserPlatform(
    import.meta.env['VITE_APP_VERSION'] ?? '0.0.0',
  );

  // --- Identity: provider-agnostic auth behind the AuthProvider port. The
  // token only proves identity; every permission is decided by the API.
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

  // --- API transport (attaches the bearer token) + the read gateways over it.
  const api = createHttpApiClient({ baseUrl: config.apiBaseUrl, auth });
  const access = makeAccessClientUseCases({
    auth,
    gateway: createRpcAccessGateway({ api }),
  });
  const directory = makeDirectoryUseCases({
    gateway: createRpcDirectoryGateway({ api }),
  });
  // Invitations: authenticated issue (members.invite) + public activation
  // (plain fetch to /invitations/activate; the secret token is the credential).
  const invitations = makeInvitationsUseCases({
    invitations: createRpcInvitationsGateway({ api }),
    activation: createRpcActivationGateway({ baseUrl: config.apiBaseUrl }),
  });
  const members = makeMembersUseCases({
    gateway: createRpcMembersGateway({ api }),
  });
  const block = makeBlockUseCases({ gateway: createRpcBlockGateway({ api }) });
  const roles = createRpcRolesGateway({ api });
  const accounts = createRpcAccountAdminGateway({ api });
  const audit = createRpcAuditGateway({ api });
  const sessions = createRpcSessionsGateway({ api });
  const settings = createRpcSettingsGateway({ api });

  // --- Unused stub: the dashboard satisfies AppUseCases but renders no items.
  const items = makeItemUseCases({
    repository: createInMemoryItemRepository(),
    clock: systemClock,
    ids: uuidGenerator,
    events: nullEventPublisher,
    logger,
  });

  return {
    useCases: {
      items,
      access,
      directory,
      invitations,
      members,
      block,
      roles,
      accounts,
      audit,
      sessions,
      settings,
    },
    platform,
    logger,
  };
};
