import { type Clock, type Result, err, ok } from '@acme/shared';
import {
  findNewlyExpiredAccessGrants,
  isAccessGrantActive,
  makeSessionId,
  recordAccessGrantExpiry,
} from '@acme/domain';
import type { AccessActor, AccessGrant } from '@acme/domain';
import { type CurrentAccessDto, toCurrentAccessDto } from './dto';
import { accessActorNotFound, accessDenied } from './errors';
import type { AccessUseCaseError } from './errors';
import type {
  AccessActorReader,
  AccessGrantExpiryEntry,
  AccessGrantExpiryRecorder,
} from './ports';

export type CurrentAccessDeps = {
  readonly actors: AccessActorReader;
  readonly grantExpiry: AccessGrantExpiryRecorder;
  readonly clock: Clock;
};

const recordLazyExpiry = (
  grants: ReadonlyArray<AccessGrant>,
  now: string,
): ReadonlyArray<AccessGrantExpiryEntry> => {
  const entries: AccessGrantExpiryEntry[] = [];
  for (const grant of findNewlyExpiredAccessGrants(grants, now)) {
    const recorded = recordAccessGrantExpiry(grant, now);
    if (recorded.ok) entries.push(recorded.value);
  }
  return entries;
};

/**
 * Resolve "who is asking" from persisted state — the step the API pipeline
 * runs once per request before any procedure. Also the moment lazy
 * `grant.expired` recording happens: observing an expired grant is what
 * writes its audit event (deduplicated by the domain).
 *
 * Fails closed: an unknown session, a revoked/expired session or a disabled
 * account yields an error, never an actor.
 */
export const makeResolveRequestActor =
  (deps: CurrentAccessDeps) =>
  async (input: {
    readonly sessionId: string;
  }): Promise<Result<AccessActor, AccessUseCaseError>> => {
    const sessionId = makeSessionId(input.sessionId);
    if (!sessionId.ok) return err(sessionId.error);

    const actor = await deps.actors.findActorBySession(sessionId.value);
    if (!actor) {
      return err(accessActorNotFound('No actor for this session.'));
    }

    const now = deps.clock.now().toISOString();
    const expired = recordLazyExpiry(actor.grants, now);
    if (expired.length > 0) await deps.grantExpiry.recordExpiry(expired);

    if (actor.accountStatus !== 'active') {
      return err(
        accessDenied('Account is disabled.', {
          details: { reason: 'account-disabled' },
        }),
      );
    }
    if (
      actor.session.status !== 'active' ||
      new Date(actor.session.expiresAt).getTime() <= new Date(now).getTime()
    ) {
      return err(
        accessDenied('Session is not active.', {
          details: { reason: 'session-inactive' },
        }),
      );
    }
    return ok(actor);
  };

/**
 * The caller's current access snapshot: who they are, what they may do, and
 * which grants are live. Same fail-closed resolution as
 * `makeResolveRequestActor`, projected to the serializable client view.
 */
export const makeGetCurrentAccess = (deps: CurrentAccessDeps) => {
  const resolveActor = makeResolveRequestActor(deps);
  return async (input: {
    readonly sessionId: string;
  }): Promise<Result<CurrentAccessDto, AccessUseCaseError>> => {
    const actor = await resolveActor(input);
    if (!actor.ok) return actor;

    const now = deps.clock.now().toISOString();
    const activeGrants = actor.value.grants.filter((grant) =>
      isAccessGrantActive(grant, now),
    );
    return ok(toCurrentAccessDto(actor.value, activeGrants));
  };
};

export type AccessUseCases = {
  readonly resolveRequestActor: ReturnType<typeof makeResolveRequestActor>;
  readonly getCurrentAccess: ReturnType<typeof makeGetCurrentAccess>;
};

export const makeAccessUseCases = (
  deps: CurrentAccessDeps,
): AccessUseCases => ({
  resolveRequestActor: makeResolveRequestActor(deps),
  getCurrentAccess: makeGetCurrentAccess(deps),
});
