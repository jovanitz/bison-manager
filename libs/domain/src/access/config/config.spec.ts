import { describe, expect, it } from 'vitest';
import {
  ACCESS_ACTIONS,
  GRANT_ONLY_ACTIONS,
  isGrantOnlyAction,
  makeAccessActionIn,
} from '../value-objects';
import {
  ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
  accessPresetPermissions,
  isCustomerDelegableAction,
} from '../presets';
import { makeAccessPermissionIn } from '../permission';
import { ROLE_TEMPLATES } from '../role/templates';
import {
  defaultAccessConfig,
  makeAccessVocabulary,
  type AccessConfig,
} from './config';

const PRESET_NAMES = [
  'owner',
  'support',
  'customer',
  'customer-admin',
] as const;

describe('default access config', () => {
  it('mirrors the module-level action / grant-only / delegable constants', () => {
    expect(defaultAccessConfig.actions).toEqual([...ACCESS_ACTIONS]);
    expect(defaultAccessConfig.grantOnlyActions).toEqual([
      ...GRANT_ONLY_ACTIONS,
    ]);
    expect(defaultAccessConfig.delegableActions).toEqual([
      ...ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
    ]);
  });

  it('captures every preset by name', () => {
    for (const name of PRESET_NAMES) {
      expect(defaultAccessConfig.presets[name]).toEqual(
        accessPresetPermissions(name),
      );
    }
  });

  it('carries the default role templates', () => {
    expect(defaultAccessConfig.roleTemplates).toEqual(ROLE_TEMPLATES);
  });
});

describe('makeAccessVocabulary', () => {
  const vocab = makeAccessVocabulary(defaultAccessConfig);

  it('isKnownAction agrees with the catalog', () => {
    expect(vocab.isKnownAction('permissions.update')).toBe(true);
    expect(vocab.isKnownAction('does.not.exist')).toBe(false);
  });

  it('config-driven predicates match the module-level functions', () => {
    for (const action of ACCESS_ACTIONS) {
      expect(vocab.isGrantOnlyAction(action)).toBe(isGrantOnlyAction(action));
      expect(vocab.isDelegableAction(action)).toBe(
        isCustomerDelegableAction(action),
      );
    }
  });

  it('presetPermissions returns the same as the preset accessor', () => {
    for (const name of PRESET_NAMES) {
      expect(vocab.presetPermissions(name)).toEqual(
        accessPresetPermissions(name),
      );
    }
  });
});

describe('ADR-0016: plans/billing actions in the access vocabulary', () => {
  const holds = (
    preset: (typeof PRESET_NAMES)[number],
    action: string,
    scope: string,
  ): boolean =>
    accessPresetPermissions(preset).some(
      (p) => p.action === action && p.scope === scope,
    );

  it('catalogs plans.manage and billing.read as known actions', () => {
    expect(ACCESS_ACTIONS).toContain('plans.manage');
    expect(ACCESS_ACTIONS).toContain('billing.read');
  });

  it('owner alone manages the catalog; staff presets read billing at any', () => {
    expect(holds('owner', 'plans.manage', 'any')).toBe(true);
    expect(holds('owner', 'billing.read', 'any')).toBe(true);
    expect(holds('support', 'billing.read', 'any')).toBe(true);
    // plans.manage is owner-only in v1 — support never manages the catalog.
    expect(
      accessPresetPermissions('support').some(
        (p) => p.action === 'plans.manage',
      ),
    ).toBe(false);
  });

  it('customer-admin reads own billing; base customer does not', () => {
    expect(holds('customer-admin', 'billing.read', 'own')).toBe(true);
    expect(
      accessPresetPermissions('customer').some(
        (p) => p.action === 'billing.read',
      ),
    ).toBe(false);
  });

  it('billing.read is delegable into an org; plans.manage never is', () => {
    expect(isCustomerDelegableAction('billing.read')).toBe(true);
    expect(isCustomerDelegableAction('plans.manage')).toBe(false);
    expect(ACCESS_CUSTOMER_DELEGABLE_ACTIONS).not.toContain('plans.manage');
  });
});

// A second, structurally-different vocabulary — abstract on purpose, NOT this
// app's giro — proving the generic core serves any `AccessConfig<Action,
// Preset>`. A real app's vocabulary lives in that app (see apps/app-b), never
// in the shared domain.
type OtherAction = 'widget.read' | 'widget.write' | 'widget.purge';
type OtherPreset = 'role-a' | 'role-b';

const otherConfig: AccessConfig<OtherAction, OtherPreset> = {
  actions: ['widget.read', 'widget.write', 'widget.purge'],
  grantOnlyActions: ['widget.purge'],
  delegableActions: ['widget.read'],
  presets: {
    'role-a': [{ action: 'widget.read', scope: 'own' }],
    'role-b': [
      { action: 'widget.read', scope: 'own' },
      { action: 'widget.write', scope: 'own' },
    ],
  },
  roleTemplates: [
    {
      key: 'role-a',
      name: 'Role A',
      scope: 'org',
      permissions: [{ action: 'widget.read', scope: 'own' }],
    },
  ],
};

describe('AccessConfig generalises to a different vocabulary', () => {
  const vocab = makeAccessVocabulary(otherConfig);

  it('recognises its own catalog and rejects another vocabulary’s actions', () => {
    expect(vocab.isKnownAction('widget.write')).toBe(true);
    // bison-manager's vocabulary is independent — not known here.
    expect(vocab.isKnownAction('staff.read')).toBe(false);
  });

  it('drives its own grant-only and delegable sets', () => {
    expect(vocab.isGrantOnlyAction('widget.purge')).toBe(true);
    expect(vocab.isGrantOnlyAction('widget.read')).toBe(false);
    expect(vocab.isDelegableAction('widget.read')).toBe(true);
  });

  it('exposes its presets by name', () => {
    expect(vocab.presetPermissions('role-b')).toHaveLength(2);
  });
});

describe('makeAccessActionIn', () => {
  it('validates a raw action against an injected catalog and narrows it', () => {
    const widgets = ['widget.read', 'widget.write'] as const;
    const parsed = makeAccessActionIn('widget.read', widgets);
    expect(parsed.ok && parsed.value).toBe('widget.read');
    // An action outside the given catalog is rejected.
    expect(makeAccessActionIn('widget.read', ACCESS_ACTIONS).ok).toBe(false);
  });
});

describe('makeAccessPermissionIn', () => {
  it('validates action + scope against an injected catalog', () => {
    const widgets = ['widget.read'] as const;
    const parsed = makeAccessPermissionIn(
      { action: 'widget.read', scope: 'own' },
      widgets,
    );
    expect(parsed.ok && parsed.value).toEqual({
      action: 'widget.read',
      scope: 'own',
    });
    // An action outside the given catalog is rejected.
    expect(
      makeAccessPermissionIn(
        { action: 'widget.read', scope: 'own' },
        ACCESS_ACTIONS,
      ).ok,
    ).toBe(false);
  });
});
