import { type Clock, type Result, err, ok } from '@acme/shared';
import { ROLE_TEMPLATES, findRoleTemplate } from '@acme/domain';
import type { AccessActor, RoleTemplate } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import { guardGrantedPermissions } from '../../access-admin/deps';
import { ROLE_ACTION, parsePermissions, type RawPermission } from '../guards';
import type { RoleStore, RoleTemplateStore } from '../ports';
import { roleNotFound, type RoleUseCaseError } from '../errors';

export type TemplateDeps = {
  readonly templates: RoleTemplateStore;
  /** Propagation target (ADR-0014): a template edit ripples to its instances. */
  readonly roles: Pick<RoleStore, 'syncTemplate'>;
  readonly clock: Clock;
};

// Editing the default catalogue is a platform-staff operation: authorize the
// management action against the platform scope (accountId null → needs `any`).
const authorizePlatform = (actor: AccessActor, now: string) =>
  authorizeAccessAction({
    actor,
    action: ROLE_ACTION,
    resource: { accountId: null },
    now,
  });

/** The full default catalogue with the staff's edits applied over code. */
export const mergeTemplates = (
  stored: ReadonlyArray<RoleTemplate>,
): ReadonlyArray<RoleTemplate> => {
  const overrides = new Map(stored.map((t) => [t.key, t]));
  return ROLE_TEMPLATES.map((t) => overrides.get(t.key) ?? t);
};

/** Staff view of the editable default templates (code + their edits). */
export const makeListTemplates =
  (deps: TemplateDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<Result<ReadonlyArray<RoleTemplate>, RoleUseCaseError>> => {
    const authorized = authorizePlatform(
      input.actor,
      deps.clock.now().toISOString(),
    );
    if (!authorized.ok) return err(authorized.error);
    return ok(mergeTemplates(await deps.templates.list()));
  };

/** Edit a default template (ADR-0013): coherence by the template's own scope. */
export const makeUpdateTemplate =
  (deps: TemplateDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly key: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<RawPermission>;
  }): Promise<Result<void, RoleUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const authorized = authorizePlatform(input.actor, now);
    if (!authorized.ok) return err(authorized.error);
    const code = findRoleTemplate(input.key);
    if (!code) return err(roleNotFound(`No template "${input.key}".`));
    const permissions = parsePermissions(input.permissions);
    if (!permissions.ok) return err(permissions.error);
    const coherent = guardGrantedPermissions(
      permissions.value,
      code.scope === 'org' ? 'customer' : 'staff',
    );
    if (!coherent.ok) return err(coherent.error);
    await deps.templates.upsert({
      key: code.key,
      scope: code.scope,
      name: input.name,
      permissions: permissions.value,
    });
    // Eager propagation (ADR-0014): ripple the edit to instances still synced;
    // forked instances (org-edited) keep their local changes until reset.
    await deps.roles.syncTemplate(
      code.key,
      { name: input.name, permissions: permissions.value },
      { includeForked: false },
    );
    return ok(undefined);
  };

/**
 * Force every instance of a template — synced or forked — back to the template
 * (ADR-0014, staff "apply to all"). Overrides org-local edits, so it is the
 * deliberate, heavier counterpart to the implicit sync on edit. Staff-only.
 */
export const makeApplyTemplateToAll =
  (deps: TemplateDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly key: string;
  }): Promise<Result<{ readonly updated: number }, RoleUseCaseError>> => {
    const authorized = authorizePlatform(
      input.actor,
      deps.clock.now().toISOString(),
    );
    if (!authorized.ok) return err(authorized.error);
    const effective =
      (await deps.templates.findByKey(input.key)) ??
      findRoleTemplate(input.key);
    if (!effective) return err(roleNotFound(`No template "${input.key}".`));
    const updated = await deps.roles.syncTemplate(
      input.key,
      { name: effective.name, permissions: effective.permissions },
      { includeForked: true },
    );
    return ok({ updated });
  };

/** Reset a template to its code definition — the recovery floor (ADR-0013). */
export const makeResetTemplate =
  (deps: TemplateDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly key: string;
  }): Promise<Result<void, RoleUseCaseError>> => {
    const authorized = authorizePlatform(
      input.actor,
      deps.clock.now().toISOString(),
    );
    if (!authorized.ok) return err(authorized.error);
    const code = findRoleTemplate(input.key);
    if (!code) return err(roleNotFound(`No template "${input.key}".`));
    await deps.templates.upsert(code);
    return ok(undefined);
  };
