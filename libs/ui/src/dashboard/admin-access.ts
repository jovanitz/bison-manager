import type { CurrentAccessDto } from '@acme/application';

/**
 * UI gate: does this access snapshot belong to a platform admin?
 *
 * `any`-scope is staff-only machinery — the domain guards forbid a customer
 * membership from ever holding an `any`-scoped permission. So "holds anything
 * at `any` scope" is a sound, framework-free signal that the actor is platform
 * staff who can operate the dashboard. This only *hides* what the server would
 * deny anyway; every directory read is reauthorized server-side.
 */
export const isPlatformAdmin = (access: CurrentAccessDto): boolean =>
  access.permissions.some((permission) => permission.scope === 'any');

/**
 * Does the actor hold this action (at any scope)? Used to hide controls the
 * server would refuse anyway — UI gating only, never the enforcement.
 */
export const holdsAction = (
  access: CurrentAccessDto,
  action: string,
): boolean =>
  access.permissions.some((permission) => permission.action === action);
