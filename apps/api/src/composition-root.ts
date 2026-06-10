import { systemClock, uuidGenerator } from '@acme/shared';
import type { Clock, IdGenerator } from '@acme/shared';
import {
  makeAccessAdminUseCases,
  makeAccessUseCases,
  makeAuditTrailUseCases,
  makeImpersonationUseCases,
} from '@acme/application';
import { createInMemoryAccessStore } from '@acme/infrastructure';
import type { InMemoryAccessSeed } from '@acme/infrastructure';
import { createApi } from './app';
import { createApiProcedures } from './procedures';
import type { ApiProcedure } from './rpc/procedure';

/**
 * The API composition root — the only place concrete adapters are chosen.
 * Phase 3 wires the in-memory access store; phase 4 swaps it for the Supabase
 * adapters by editing this file alone.
 */
export type ApiRuntime = {
  readonly app: ReturnType<typeof createApi>;
  /** The declared surface — what the future MCP tool registry will publish. */
  readonly procedures: ReadonlyArray<ApiProcedure>;
};

export const createApiRuntime = (config: {
  readonly seed: InMemoryAccessSeed;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}): ApiRuntime => {
  const clock = config.clock ?? systemClock;
  const ids = config.ids ?? uuidGenerator;
  const store = createInMemoryAccessStore(config.seed);

  const access = makeAccessUseCases({
    actors: store.actors,
    grantExpiry: store.grantExpiry,
    clock,
  });
  const auditTrail = makeAuditTrailUseCases({ trail: store.auditTrail, clock });
  const accessAdmin = makeAccessAdminUseCases({ admin: store.admin, clock });
  const impersonation = makeImpersonationUseCases({
    grants: store.grants,
    customers: store.customers,
    clock,
    ids,
  });

  const procedures = createApiProcedures({
    access,
    auditTrail,
    accessAdmin,
    impersonation,
  });
  const app = createApi({
    procedures,
    resolveActor: access.resolveRequestActor,
  });
  return { app, procedures };
};
