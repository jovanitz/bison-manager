import { describe, expect, it } from 'vitest';
import {
  appBAccessVocabulary,
  parseAppBAction,
  parseAppBPermission,
} from './access';

describe('app B access vocabulary', () => {
  it('reuses the generic core with its own catalog', () => {
    expect(appBAccessVocabulary.isKnownAction('sale.create')).toBe(true);
    // bison-manager's actions are independent — not part of app B's catalog.
    expect(appBAccessVocabulary.isKnownAction('customer.search')).toBe(false);
  });

  it('drives its own grant-only action (controlled dispensing)', () => {
    expect(appBAccessVocabulary.isGrantOnlyAction('controlled.dispense')).toBe(
      true,
    );
    expect(appBAccessVocabulary.isGrantOnlyAction('sale.create')).toBe(false);
  });

  it('exposes its own org presets', () => {
    expect(appBAccessVocabulary.presetPermissions('vendedor')).toHaveLength(3);
    expect(appBAccessVocabulary.isDelegableAction('sale.create')).toBe(true);
    expect(appBAccessVocabulary.isDelegableAction('inventory.adjust')).toBe(
      false,
    );
  });

  it('parses raw actions against its OWN catalog via the shared parser', () => {
    const ok = parseAppBAction('sale.create');
    expect(ok.ok && ok.value).toBe('sale.create');
    // bison-manager's actions are not valid input here.
    expect(parseAppBAction('customer.search').ok).toBe(false);
  });

  it('parses a full permission against its OWN catalog', () => {
    const ok = parseAppBPermission({ action: 'sale.create', scope: 'own' });
    expect(ok.ok && ok.value).toEqual({ action: 'sale.create', scope: 'own' });
    expect(
      parseAppBPermission({ action: 'customer.search', scope: 'own' }).ok,
    ).toBe(false);
    // an unknown scope is rejected too.
    expect(
      parseAppBPermission({ action: 'sale.create', scope: 'nope' }).ok,
    ).toBe(false);
  });
});
