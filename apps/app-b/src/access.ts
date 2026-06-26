import {
  makeAccessActionIn,
  makeAccessPermissionIn,
  makeAccessVocabulary,
} from '@acme/domain';
import type { AccessConfig } from '@acme/domain';

/**
 * App B — a pharmacy POS + inventory app. This is its **own** authorization
 * vocabulary, living here in the app and never in the shared domain (ADR-0015:
 * the generic access core is reused verbatim; only the vocabulary is per-app).
 *
 * Intentionally minimal and NOT final — the business is not modeled yet. It only
 * needs to be a second, distinct vocabulary so the generic core is exercised by
 * a real composition root (the second consumer that drives Fase 0b).
 */
export type AppBAction =
  | 'permissions.update'
  | 'members.invite'
  | 'members.read'
  | 'audit.read'
  | 'sale.create'
  | 'sale.read'
  | 'inventory.read'
  | 'inventory.adjust'
  | 'controlled.dispense';

export type AppBPreset = 'owner' | 'support' | 'vendedor' | 'administrador';

export const appBAccessConfig: AccessConfig<AppBAction, AppBPreset> = {
  actions: [
    'permissions.update',
    'members.invite',
    'members.read',
    'audit.read',
    'sale.create',
    'sale.read',
    'inventory.read',
    'inventory.adjust',
    'controlled.dispense',
  ],
  // Dispensing a controlled substance is never held as a permission — only ever
  // a temporary, audited grant (same mechanism as bison-manager's customer.read).
  grantOnlyActions: ['controlled.dispense'],
  delegableActions: [
    'sale.create',
    'sale.read',
    'inventory.read',
    'members.read',
  ],
  presets: {
    owner: [{ action: 'permissions.update', scope: 'any' }],
    support: [{ action: 'sale.read', scope: 'any' }],
    vendedor: [
      { action: 'sale.create', scope: 'own' },
      { action: 'sale.read', scope: 'own' },
      { action: 'inventory.read', scope: 'own' },
    ],
    administrador: [
      { action: 'permissions.update', scope: 'own' },
      { action: 'members.invite', scope: 'own' },
      { action: 'members.read', scope: 'own' },
      { action: 'inventory.adjust', scope: 'own' },
      { action: 'audit.read', scope: 'own' },
    ],
  },
  roleTemplates: [
    {
      key: 'vendedor',
      name: 'Vendedor',
      scope: 'org',
      permissions: [{ action: 'sale.create', scope: 'own' }],
    },
    {
      key: 'administrador',
      name: 'Administrador',
      scope: 'org',
      permissions: [{ action: 'permissions.update', scope: 'own' }],
    },
  ],
};

/**
 * App B's composition root (minimal). The shared, generic access core is reused
 * verbatim; only the vocabulary above is app-specific and injected here. As the
 * rest of Fase 0b lands, this is where app B's remaining auth wiring plugs in.
 */
export const appBAccessVocabulary = makeAccessVocabulary(appBAccessConfig);

/**
 * App B's boundary validator — parses a raw action string against app B's own
 * catalog, narrowing to `AppBAction`. The generic `makeAccessActionIn` is the
 * same parser bison-manager uses; only the catalog differs.
 */
export const parseAppBAction = (raw: string) =>
  makeAccessActionIn<AppBAction>(raw, appBAccessConfig.actions);

/**
 * App B's boundary validator for a full permission (action + scope), narrowing
 * to `AppBAction`. Same generic parser as bison-manager; only the catalog differs.
 */
export const parseAppBPermission = (raw: {
  readonly action: string;
  readonly scope: string;
}) => makeAccessPermissionIn<AppBAction>(raw, appBAccessConfig.actions);
