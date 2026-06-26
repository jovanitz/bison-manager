import { type Result, err, ok } from '@acme/shared';
import {
  evaluateAccessPolicy,
  type AccessAction,
  type AccessActor,
  type AccessDecision,
  type AccessResource,
} from '@acme/domain';
import { accessDenied } from './errors';
import type { AccessUseCaseError } from './errors';

/**
 * The single enforcement gate every use case calls before touching a port.
 * Wraps the pure policy decision into the use-case error channel so a denial
 * short-circuits orchestration exactly like any other expected failure.
 */
export const authorizeAccessAction = (input: {
  readonly actor: AccessActor;
  readonly action: AccessAction;
  readonly resource: AccessResource;
  readonly now: string;
  /**
   * The app's grant-only actions (ADR-0015 vocabulary injection). Forwarded to
   * the policy core; omitted by bison-manager (defaults there), supplied by a
   * different app's composition root.
   */
  readonly grantOnlyActions?: ReadonlyArray<AccessAction>;
}): Result<AccessDecision, AccessUseCaseError> => {
  const decision = evaluateAccessPolicy(input);
  if (!decision.allowed) {
    return err(
      accessDenied(`Action ${input.action} is not permitted.`, {
        details: { action: input.action, reason: decision.reason },
      }),
    );
  }
  return ok(decision);
};
