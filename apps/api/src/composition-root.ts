import { systemClock, uuidGenerator } from '@acme/shared';
import {
  makeAccessAdminUseCases,
  makeAccessBlockUseCases,
  makeAccessDirectoryUseCases,
  makeAccessInvitationsUseCases,
  makeAccessMembersUseCases,
  makeAccessOrgDetailUseCases,
  makeAccessRolesUseCases,
  makeAccessSettingsUseCases,
  makeAccessUseCases,
  makeAuditTrailUseCases,
  makeCreateOrganizationUseCases,
  makeIdentityUseCases,
  makeImpersonationUseCases,
} from '@acme/application';
import {
  createInMemoryAccessStore,
  createInMemoryIdentityProvisioner,
  createInMemorySubscriptionStore,
  makeOrgDetailReader,
  toBillingStoreState,
} from '@acme/infrastructure';
import {
  createNodeSecretTokenService,
  createPostgresAccessStore,
  createSupabaseAdminProvisioner,
} from '@acme/infrastructure-node';
import { createApi } from './app';
import { createSupabaseTokenVerifier } from './identity/token-verifier';
import { createApiProcedures } from './procedures';
import type { ApiIdentityPipeline } from './rpc/actor-middleware';
import type { ApiProcedure } from './rpc/procedure';
import { toCreateOrgBilling, wireBilling } from './wiring/billing';
import {
  extraProceduresOf,
  toApiOptions,
  toVerifierConfig,
} from './wiring/config';
import type { ApiConfig } from './wiring/config';

export type { ApiConfig } from './wiring/config';

/**
 * The API composition root — the only place concrete adapters are chosen.
 * Two axes, both decided here and nowhere else:
 * - store: Postgres/Supabase when `databaseUrl` is set, else in-memory + seed.
 * - identity: Supabase JWT verification + session onboarding when `jwtSecret`
 *   is set, else the dev/test stub (bearer token = session id).
 */
export type ApiRuntime = {
  readonly app: ReturnType<typeof createApi>;
  /** The declared surface — what the future MCP tool registry will publish. */
  readonly procedures: ReadonlyArray<ApiProcedure>;
  /**
   * Idempotently instantiate the platform-scope default roles (ADR-0012/0014).
   * Org defaults are seeded on org creation; the platform has no creation event,
   * so the boot seeds them here. Safe to call on every start (skips existing).
   */
  readonly seedPlatformDefaults: () => Promise<{ readonly created: number }>;
  readonly close: () => Promise<void>;
};

export const createApiRuntime = (config: ApiConfig): ApiRuntime => {
  const clock = config.clock ?? systemClock;
  const ids = config.ids ?? uuidGenerator;
  // Billing state FIRST (ADR-0016): the in-memory onboarding's atomic org
  // birth writes subscriptions through the same maps the billing stores read.
  // (With Postgres, the onboarding adapter writes the billing TABLES in its
  // own transaction; the in-memory billing wiring below still serves the
  // catalog until the Postgres billing store is wired — F5.)
  const billingState = toBillingStoreState(config.billingSeed);
  const store = config.databaseUrl
    ? createPostgresAccessStore({ databaseUrl: config.databaseUrl })
    : {
        ...createInMemoryAccessStore(
          config.seed ?? {},
          createInMemorySubscriptionStore(billingState),
        ),
        close: undefined,
      };

  const access = makeAccessUseCases({
    actors: store.actors,
    grantExpiry: store.grantExpiry,
    sessionPolicies: store.sessionPolicies,
    sessionActivity: store.sessionActivity,
    clock,
  });
  const auditTrail = makeAuditTrailUseCases({ trail: store.auditTrail, clock });
  const accessAdmin = makeAccessAdminUseCases({
    admin: store.admin,
    settings: store.sessionPolicies,
    clock,
  });
  const accessDirectory = makeAccessDirectoryUseCases({
    staffDirectory: store.staffDirectory,
    customers: store.customers,
    clock,
  });
  const accessBlock = makeAccessBlockUseCases({
    blocks: store.blocks,
    accounts: store.admin,
    clock,
  });
  const accessRoles = makeAccessRolesUseCases({
    roles: store.roles,
    templates: store.roleTemplates,
    admin: store.admin,
    clock,
    ids,
  });
  // Billing (ADR-0016): its own bounded context, composed over the access
  // store's member/ownership surface and the pre-built shared state (the
  // code floor is seeded idempotently by `toBillingStoreState`).
  const billing = wireBilling({
    access: store,
    clock,
    ids,
    state: billingState,
  });
  // The enforcement vertical (ADR-0016 Decision 4): the pre-actor ownership
  // guard + trial-once probe + default plan feed org creation.
  const { createOrganization } = makeCreateOrganizationUseCases({
    onboarding: store.onboarding,
    installDefaults: accessRoles.installDefaults,
    billing: toCreateOrgBilling(billing),
    clock,
    ids,
  });
  const impersonation = makeImpersonationUseCases({
    grants: store.grants,
    customers: store.customers,
    clock,
    ids,
  });

  const verifierConfig = toVerifierConfig(config);
  const identity: ApiIdentityPipeline | undefined = verifierConfig
    ? {
        verifier: createSupabaseTokenVerifier(verifierConfig),
        registerSession: makeIdentityUseCases({
          onboarding: store.onboarding,
          sessionPolicies: store.sessionPolicies,
          sessions: store.admin,
          invitations: store.invitations,
          members: store.members,
          // ADR-0016 D1: the attach-time seat ceiling for invitation accepts.
          billing: { seatLimitFor: billing.guards.seatLimitFor },
          clock,
          ids,
          bootstrapOwnerEmail: config.bootstrapOwnerEmail ?? null,
        }).registerIdentitySession,
      }
    : undefined;

  const accessSettings = makeAccessSettingsUseCases({
    settings: store.sessionPolicies,
    clock,
  });
  // Activation needs to mint identities: real Supabase admin when configured,
  // else an in-memory provisioner (dev-stub / tests). The token service is
  // server-side everywhere (CSPRNG + one-way hash).
  const provisioner =
    config.supabaseUrl && config.supabaseSecretKey
      ? createSupabaseAdminProvisioner({
          supabaseUrl: config.supabaseUrl,
          secretKey: config.supabaseSecretKey,
        })
      : createInMemoryIdentityProvisioner();
  const accessInvitations = makeAccessInvitationsUseCases({
    invitations: store.invitations,
    accounts: store.admin,
    roles: store.roles,
    tokens: createNodeSecretTokenService(),
    provisioner,
    clock,
    ids,
  });
  const accessMembers = makeAccessMembersUseCases({
    members: store.members,
    accounts: store.admin,
    sessionPolicies: store.sessionPolicies,
    clock,
  });
  const procedures = [
    ...createApiProcedures({
      access,
      auditTrail,
      accessAdmin,
      accessDirectory,
      accessBlock,
      impersonation,
      accessSettings,
      accessInvitations,
      accessMembers,
      accessRoles,
      accessOrgDetail: makeAccessOrgDetailUseCases({
        orgs: makeOrgDetailReader(store),
        clock,
      }),
      billingPlans: billing.plans,
      billingSubscriptions: billing.subscriptions,
    }),
    // TEST-ONLY seam (see ApiConfig): pipeline contract tests inject probes.
    ...extraProceduresOf(config),
  ];
  const app = createApi({
    procedures,
    resolveActor: access.resolveRequestActor,
    guardFeature: billing.guards.guardFeature,
    activateInvitation: accessInvitations.activateInvitation,
    createOrganization,
    // First-run: true while the instance has no root admin (drives the
    // dashboard's one-time owner sign-up). Same source as the bootstrap guard.
    needsBootstrap: async () => !(await store.onboarding.rootAdminExists()),
    ...toApiOptions(config, identity, {
      secret: config.authHookSecret ?? null,
      recordFailedLogin: auditTrail.recordFailedLogin,
    }),
  });
  return {
    app,
    procedures,
    seedPlatformDefaults: async () => {
      const result = await accessRoles.installDefaults(null);
      return result.ok ? result.value : { created: 0 };
    },
    close: async () => {
      await store.close?.();
    },
  };
};
