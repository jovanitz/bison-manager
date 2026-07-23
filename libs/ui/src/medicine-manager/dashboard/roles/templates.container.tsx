import { useEffect } from 'react';
import { useTemplatesStore, useStore } from '../store/hooks';
import type { TemplatesStore } from '../store/roles/templates-store';
import { TemplatesView } from './templates.view';
import type { TemplatesActions } from './roles.types';

/**
 * The DI-bound Templates container (ADR-0013/0014, ADR-0017 giro-owned). Reads
 * the ViewModel from the store and dispatches edit / reset / apply-to-all; the
 * apply count surfaces as a notice. No orchestration here — it only wires the
 * pure `TemplatesView` to the store. Loads on mount; `permissions.update` is
 * enforced server-side (the flow returns `canManage: false` without it).
 */
const buildActions = (store: TemplatesStore): TemplatesActions => {
  const state = () => store.getState();
  return {
    onEdit: (key) => state().openEdit(key),
    onSubmitForm: (draft) => void state().submitForm(draft),
    onCancelForm: () => state().cancelForm(),
    onReset: (key) => state().openReset(key),
    onConfirmReset: () => void state().confirmReset(),
    onCancelReset: () => state().cancelReset(),
    onApplyToAll: (key) => state().openApply(key),
    onConfirmApply: () => void state().confirmApply(),
    onCancelApply: () => state().cancelApply(),
  };
};

const TemplatesBound = ({ store }: { readonly store: TemplatesStore }) => {
  const vm = useStore(store, (state) => state.vm);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return <TemplatesView vm={vm} {...buildActions(store)} />;
};

export const TemplatesSection = () => {
  const store = useTemplatesStore();
  if (!store) return null;
  return <TemplatesBound store={store} />;
};
