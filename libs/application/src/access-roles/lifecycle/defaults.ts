import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import {
  createRole,
  findRoleTemplate,
  roleTemplatesForScope,
} from '@acme/domain';
import type { AccessActor, AccountId, RoleId } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import type { RoleStore } from '../ports';
import { roleNotFound, roleNotResettable } from '../errors';
import type { RoleUseCaseError } from '../errors';

// Reset/install are "deciding who-can-do-what" — same gate as editing
// permissions; root/owner reach it by bypass (ADR-0011/0012).
const ROLE_ACTION = 'permissions.update' as const;

export type ResetRoleDeps = {
  readonly roles: RoleStore;
  readonly clock: Clock;
};

/** Restore a default role to its factory template (ADR-0012): same id, the
 * template's name + permissions. Refused on a custom role (nothing to reset). */
export const makeResetRole =
  (deps: ResetRoleDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly roleId: string;
  }): Promise<Result<void, RoleUseCaseError>> => {
    const role = await deps.roles.findById(input.roleId as RoleId);
    if (!role) return err(roleNotFound('No such role.'));
    if (role.templateKey === null) {
      return err(roleNotResettable('This role is not a default.'));
    }
    const template = findRoleTemplate(role.templateKey);
    if (!template) {
      return err(roleNotResettable('No factory template for this role.'));
    }
    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: ROLE_ACTION,
      resource: { accountId: role.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);
    const updated = await deps.roles.update(role.id, {
      name: template.name,
      permissions: template.permissions,
    });
    return updated ? ok(undefined) : err(roleNotFound('No such role.'));
  };

export type InstallDefaultsDeps = {
  readonly roles: RoleStore;
  readonly ids: IdGenerator;
};

/**
 * Idempotently instantiate the scope's factory templates as live roles for an
 * account (`accountId: null` = platform). A system seeding op — the caller
 * authorizes (the API wraps it; onboarding calls it on org creation). Skips
 * templates already present, so it is safe to re-run.
 */
export const makeInstallDefaults =
  (deps: InstallDefaultsDeps) =>
  async (
    accountId: AccountId | null,
  ): Promise<Result<{ readonly created: number }, RoleUseCaseError>> => {
    const scope = accountId === null ? 'platform' : 'org';
    const existing = await deps.roles.list(accountId);
    const present = new Set(
      existing.flatMap((role) =>
        role.templateKey !== null ? [role.templateKey] : [],
      ),
    );
    let created = 0;
    for (const template of roleTemplatesForScope(scope)) {
      if (present.has(template.key)) continue;
      const role = createRole({
        id: deps.ids.next() as RoleId,
        name: template.name,
        accountId,
        permissions: template.permissions,
        templateKey: template.key,
      });
      if (!role.ok) return err(role.error);
      await deps.roles.create(role.value);
      created += 1;
    }
    return ok({ created });
  };
