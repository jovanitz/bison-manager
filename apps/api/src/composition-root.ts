import { systemClock, uuidGenerator } from '@acme/shared';
import {
  makeAccessOrgDetailUseCases,
  makeCreateOrganizationUseCases,
} from '@acme/application';
import {
  createInMemoryAccessStore,
  createInMemorySubscriptionStore,
  makeOrgDetailReader,
  toBillingStoreState,
} from '@acme/infrastructure';
import { createPostgresAccessStore } from '@acme/infrastructure-node';
import { createApi } from './app';
import { createApiProcedures } from './procedures';
import type { ApiProcedure } from './rpc/procedure';
import { wireAccess } from './wiring/access';
import { toIdentityPurger } from './wiring/purger';
import { toCreateOrgBilling, wireBilling } from './wiring/billing';
import { wireIdentity } from './wiring/identity';
import { wireInvitations } from './wiring/invitations';
import { extraProceduresOf, toApiOptions } from './wiring/config';
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

  const {
    access,
    auditTrail,
    accessAdmin,
    accessDirectory,
    accessBlock,
    accessRoles,
    accessSettings,
    accessMembers,
    impersonation,
  } = wireAccess({ store, purger: toIdentityPurger(config, store), clock, ids });
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

  const identity = wireIdentity(config, {
    onboarding: store.onboarding,
    sessionPolicies: store.sessionPolicies,
    sessions: store.admin,
    invitations: store.invitations,
    members: store.members,
    // ADR-0016 D1: the attach-time seat ceiling for invitation accepts.
    billing: { seatLimitFor: billing.guards.seatLimitFor },
    clock,
    ids,
  });

  const accessInvitations = wireInvitations(config, {
    invitations: store.invitations,
    accounts: store.admin,
    roles: store.roles,
    clock,
    ids,
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
      getCoverage: billing.getCoverage,
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
