import type { CurrentAccessDto } from '../access/dto';

/**
 * Framework-free authorization predicates over an access snapshot. They were
 * born in the UI (`libs/ui/src/dashboard/admin-access.ts`) but carry no React/
 * browser dependency — they are pure rules over a DTO, so they belong in
 * `application`, where BOTH the UI and a headless MCP server reuse them.
 *
 * Every predicate only decides what to *hide*; the server re-enforces every
 * action regardless of what the client computed.
 */

/**
 * Does this snapshot belong to a platform admin? `any`-scope is staff-only
 * machinery (the domain forbids a customer membership from holding it), so
 * "holds anything at `any` scope" is a sound staff signal.
 */
export const isPlatformAdmin = (access: CurrentAccessDto): boolean =>
  access.permissions.some((permission) => permission.scope === 'any');

/** Does the actor hold this action (at any scope)? UI gating only. */
export const holdsAction = (
  access: CurrentAccessDto,
  action: string,
): boolean =>
  access.permissions.some((permission) => permission.action === action);
