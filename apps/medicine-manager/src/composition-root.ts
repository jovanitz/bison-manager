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
  type AuthProvider,
} from '@acme/application';
import {
  createFakeAuthProvider,
  createHttpApiClient,
  createInMemoryItemRepository,
  createRpcAccessGateway,
  createRpcAccountAdminGateway,
  createRpcAuditGateway,
  createRpcSessionsGateway,
  createRpcSettingsGateway,
  createRpcActivationGateway,
  createRpcBlockGateway,
  createRpcCoverageGateway,
  createRpcDirectoryGateway,
  createRpcInvitationsGateway,
  createRpcMembersGateway,
  createRpcRolesGateway,
  createSupabaseAuthProvider,
} from '@acme/infrastructure';
import { createBrowserPlatform, type Platform } from '@acme/platform';
import type { AppUseCases } from '@acme/ui';

/**
 * The MEDICINE-MANAGER giro composition root (ADR-0017) — an app isolated from
 * the existing giro: its own adapters, shell and routing, never referencing
 * `apps/dashboard`. Online-only and staff-facing: identity (Supabase or the
 * local dev seam), an API transport, and the access + directory + billing
 * coverage gateways over it. The `items` bundle is an unused stub so the shared
 * `AppUseCases` contract holds; this app renders no item screens.
 *
 * NOTE: this reuses the existing giro's API + Supabase locally. Physical
 * isolation of the API/DB per ADR-0017 is a deliberate follow-up.
 */
export type MedicineManagerConfig = {
  apiBaseUrl: string;
  supabaseUrl: string;
  /** Public (anon/publishable) key — not a secret; the API enforces access. */
  supabaseAnonKey: string;
  /**
   * LOCAL-ONLY escape hatch: when true, identity is a static dev session
   * (`Bearer <devSession>`) instead of Supabase, so the app runs against the
   * API's dev-stub seeded world with NO interactive login. Never set in prod.
   */
  devAuth: boolean;
  devSession: string;
};

export type MedicineManagerRuntime = {
  readonly useCases: AppUseCases;
  readonly platform: Platform;
  readonly logger: Logger;
};

/** Identity behind the port: the dev seam locally, Supabase everywhere else. */
const buildAuth = (
  config: MedicineManagerConfig,
  platform: Platform,
): AuthProvider =>
  config.devAuth
    ? createFakeAuthProvider({ accessToken: config.devSession })
    : createSupabaseAuthProvider({
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

export const createMedicineManagerRuntime = (
  config: MedicineManagerConfig,
): MedicineManagerRuntime => {
  const logger = createConsoleLogger({ app: 'medicine-manager' });
  const platform = createBrowserPlatform(
    import.meta.env['VITE_APP_VERSION'] ?? '0.0.0',
  );

  const auth = buildAuth(config, platform);
  const api = createHttpApiClient({ baseUrl: config.apiBaseUrl, auth });

  const access = makeAccessClientUseCases({
    auth,
    gateway: createRpcAccessGateway({ api }),
  });
  const directory = makeDirectoryUseCases({
    gateway: createRpcDirectoryGateway({ api }),
  });
  // Derived billing coverage (ADR-0018) for the Directory's Organizations rows.
  const coverage = createRpcCoverageGateway({ api });
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

  // Unused stub: this app satisfies AppUseCases but renders no item screens.
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
      coverage,
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
