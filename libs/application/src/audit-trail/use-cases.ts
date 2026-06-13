import { type Clock, type Result, err, ok } from '@acme/shared';
import type { AccessActor, AccountId } from '@acme/domain';
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
    // The audited slice IS the resource: filtering by an account lets `own`
    // scope authorize an org admin on their account; the unfiltered (global)
    // trail stays `any`-only.
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'audit.read',
      resource: {
        accountId: (input.filter?.accountId as AccountId | undefined) ?? null,
      },
      now: deps.clock.now().toISOString(),
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.trail.list(input.filter));
  };

/**
 * Records a failed login attempt. No actor and no policy check: this is fed
 * by the auth provider's webhook (signature-gated at the API edge), not by a
 * user request — the identity provider is the witness.
 */
export const makeRecordFailedLogin =
  (deps: AuditTrailDeps) =>
  async (input: { readonly identifier: string }): Promise<void> => {
    await deps.trail.append({
      type: 'login.failed',
      attemptedIdentifier: input.identifier,
      occurredAt: deps.clock.now().toISOString(),
    });
  };

export type AuditTrailUseCases = {
  readonly listAuditEvents: ReturnType<typeof makeListAuditEvents>;
  readonly recordFailedLogin: ReturnType<typeof makeRecordFailedLogin>;
};

export const makeAuditTrailUseCases = (
  deps: AuditTrailDeps,
): AuditTrailUseCases => ({
  listAuditEvents: makeListAuditEvents(deps),
  recordFailedLogin: makeRecordFailedLogin(deps),
});
