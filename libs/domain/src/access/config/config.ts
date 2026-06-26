import type { AccessPermissionOf } from '../permission';
import type { AccessAction } from '../value-objects';
import { ACCESS_ACTIONS, GRANT_ONLY_ACTIONS } from '../value-objects';
import type { AccessPresetName } from '../presets';
import {
  ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
  accessPresetPermissions,
} from '../presets';
import type { RoleTemplate, RoleTemplateScope } from '../role/templates';
import { ROLE_TEMPLATES } from '../role/templates';

/** A default-role definition, generic over a per-app action vocabulary. */
export type RoleTemplateLike<Action extends string = AccessAction> = {
  readonly key: string;
  readonly name: string;
  readonly scope: RoleTemplateScope;
  readonly permissions: ReadonlyArray<AccessPermissionOf<Action>>;
};

/**
 * The per-app authorization VOCABULARY as injectable data (Fase 0 of the
 * shareable-auth plan). Everything app-specific about *what can be authorized*
 * lives here, so one generic core can serve a different business (giro): the
 * catalog of actions, which are grant-only (never held, only granted), which
 * may be delegated into a customer org, the administrative presets, and the
 * default role templates.
 *
 * It is generic over the action union (`Action`) and the preset names
 * (`Preset`) so each app keeps its OWN compile-time-checked vocabulary while
 * the core stays polymorphic. Both default to this app's (bison-manager's)
 * types, so existing usages need no change.
 *
 * The policy MECHANICS (evaluate, scopes, expand, anti-orphan, grants, session
 * policy) are vocabulary-agnostic and are reused verbatim across apps — only
 * this config changes per app.
 */
export type AccessConfig<
  Action extends string = AccessAction,
  Preset extends string = AccessPresetName,
> = {
  readonly actions: ReadonlyArray<Action>;
  readonly grantOnlyActions: ReadonlyArray<Action>;
  readonly delegableActions: ReadonlyArray<Action>;
  readonly presets: Readonly<
    Record<Preset, ReadonlyArray<AccessPermissionOf<Action>>>
  >;
  readonly roleTemplates: ReadonlyArray<RoleTemplateLike<Action>>;
};

/**
 * This app's (bison-manager's) vocabulary, expressed as the single injectable
 * value a composition root passes in. Sourced from the module-level constants
 * so there is exactly ONE source of truth during the migration; a second app
 * supplies its own `AccessConfig<ItsAction, ItsPreset>` instead of these.
 */
export const defaultAccessConfig: AccessConfig = {
  actions: ACCESS_ACTIONS,
  grantOnlyActions: GRANT_ONLY_ACTIONS,
  delegableActions: ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
  presets: {
    owner: accessPresetPermissions('owner'),
    support: accessPresetPermissions('support'),
    customer: accessPresetPermissions('customer'),
    'customer-admin': accessPresetPermissions('customer-admin'),
  },
  roleTemplates: ROLE_TEMPLATES as ReadonlyArray<RoleTemplate>,
};

/**
 * A vocabulary handle: the config plus the config-driven predicates that today
 * live as module-level functions over the constants. Consumers wired per app
 * take this instead of importing the globals, so the same code path serves any
 * giro's vocabulary.
 */
export type AccessVocabulary<
  Action extends string = AccessAction,
  Preset extends string = AccessPresetName,
> = {
  readonly config: AccessConfig<Action, Preset>;
  readonly isKnownAction: (raw: string) => boolean;
  readonly isGrantOnlyAction: (action: Action) => boolean;
  readonly isDelegableAction: (action: Action) => boolean;
  readonly presetPermissions: (
    name: Preset,
  ) => ReadonlyArray<AccessPermissionOf<Action>>;
};

export const makeAccessVocabulary = <
  Action extends string = AccessAction,
  Preset extends string = AccessPresetName,
>(
  config: AccessConfig<Action, Preset>,
): AccessVocabulary<Action, Preset> => ({
  config,
  isKnownAction: (raw) => config.actions.some((action) => action === raw),
  isGrantOnlyAction: (action) => config.grantOnlyActions.includes(action),
  isDelegableAction: (action) => config.delegableActions.includes(action),
  presetPermissions: (name) => config.presets[name],
});
