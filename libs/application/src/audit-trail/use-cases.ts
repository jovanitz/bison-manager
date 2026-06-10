import { type Clock, type Result, err, ok } from '@acme/shared';
import type { AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import type { AccessUseCaseError } from '../access/errors';
import type {
  AccessAuditFilter,
  AccessAuditRecord,
  AccessAuditTrail,
} from './ports';

export type AuditTrailDeps = {
  readonly trail: AccessAuditTrail;
  readonly clock: Clock;
};

export const makeListAuditEvents =
  (deps: AuditTrailDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly filter?: AccessAuditFilter;
  }): Promise<Result<ReadonlyArray<AccessAuditRecord>, AccessUseCaseError>> => {
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'audit.read',
      resource: { accountId: null },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.trail.list(input.filter));
  };

export type AuditTrailUseCases = {
  readonly listAuditEvents: ReturnType<typeof makeListAuditEvents>;
};

export const makeAuditTrailUseCases = (
  deps: AuditTrailDeps,
): AuditTrailUseCases => ({
  listAuditEvents: makeListAuditEvents(deps),
});
