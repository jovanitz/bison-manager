import { useEffect } from 'react';
import { useSettingsStore, useStore } from '../store/hooks';
import type { SettingsStore } from '../store/settings/settings-store';
import { SettingsView } from './settings.view';

/**
 * The DI-bound Settings container (ADR-0010, ADR-0017 giro-owned). Reads the
 * session-policy ViewModel from the store and dispatches save. No orchestration
 * here — it only wires the pure `SettingsView` to the store. Loads on mount; the
 * `settings.update` gate is enforced server-side (the flow returns hidden →
 * `canManage: false`, so the view renders read-only).
 */
const SettingsBound = ({ store }: { readonly store: SettingsStore }) => {
  const vm = useStore(store, (state) => state.vm);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return <SettingsView vm={vm} onSave={(p) => void store.getState().save(p)} />;
};

export const SettingsSection = () => {
  const store = useSettingsStore();
  if (!store) return null;
  return <SettingsBound store={store} />;
};
