import { type Clock, type Result, err, ok } from '@acme/shared';
import { makeAccessSessionPolicies } from '@acme/domain';
import type { AccessActor, AccessSessionPolicies } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { settingsConflict } from './errors';
import type { AccessSettingsUseCaseError } from './errors';
import type { AccessSessionPolicyStore } from './ports';

export type AccessSettingsDeps = {
  readonly settings: AccessSessionPolicyStore;
  readonly clock: Clock;
};

export type SessionPolicyInput = {
  readonly idleTtlMs: number;
  readonly maxLifetimeMs: number;
};

/**
 * Reconfigures the session lifetime policy at runtime (owner capability via
 * `settings.update`). The domain validates the hard bounds; the store commits
 * settings + audit + the immediate shrink of live sessions atomically.
 */
export const makeUpdateSessionPolicy =
  (deps: AccessSettingsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly policies: {
      readonly customer: SessionPolicyInput;
      readonly staff: SessionPolicyInput;
    };
    /** Version the editor loaded; omit to skip the optimistic check. */
    readonly expectedVersion?: number;
  }): Promise<Result<AccessSessionPolicies, AccessSettingsUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'settings.update',
      resource: { accountId: null },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const validated = makeAccessSessionPolicies(input.policies);
    if (!validated.ok) return err(validated.error);

    const current = await deps.settings.loadSessionSettings();
    if (
      input.expectedVersion !== undefined &&
      input.expectedVersion !== current.version
    ) {
      return err(
        settingsConflict('The session policy changed since you loaded it.'),
      );
    }
    const saved = await deps.settings.saveSessionPolicies(
      validated.value,
      {
        type: 'settings.updated',
        actorMembershipId: input.actor.membership.id,
        before: current.policies,
        after: validated.value,
        occurredAt: now,
      },
      current.version,
    );
    if (!saved) {
      return err(
        settingsConflict('The session policy changed since you loaded it.'),
      );
    }
    return ok(validated.value);
  };

export type AccessSettingsUseCases = {
  readonly updateSessionPolicy: ReturnType<typeof makeUpdateSessionPolicy>;
};

export const makeAccessSettingsUseCases = (
  deps: AccessSettingsDeps,
): AccessSettingsUseCases => ({
  updateSessionPolicy: makeUpdateSessionPolicy(deps),
});
