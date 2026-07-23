import { useEffect } from 'react';
import { useRolesStore, useStore } from '../store/hooks';
import type { RolesStore } from '../store/roles/roles-store';
import { RolesView } from './roles.view';
import type { RolesActions } from './roles.types';

/**
 * The DI-bound Roles container (ADR-0011, ADR-0017 giro-owned). Reads the
 * ViewModel from the store and dispatches every lever to it: create / edit
 * (live to holders) / delete / reset. No orchestration here — it only wires the
 * pure `RolesView` to the store, which owns the flow. Loads on mount; the
 * `permissions.update` gate is enforced server-side (the flow returns
 * `canManage: false` without it, so the view hides the manage levers).
 */
const buildActions = (store: RolesStore): RolesActions => {
  const state = () => store.getState();
  return {
    onCreate: () => state().openCreate(),
    onEdit: (id) => state().openEdit(id),
    onSubmitForm: (draft) => void state().submitForm(draft),
    onCancelForm: () => state().cancelForm(),
    onDelete: (id) => state().openDelete(id),
    onConfirmDelete: () => void state().confirmDelete(),
    onCancelDelete: () => state().cancelDelete(),
    onReset: (id) => state().openReset(id),
    onConfirmReset: () => void state().confirmReset(),
    onCancelReset: () => state().cancelReset(),
  };
};

const RolesBound = ({ store }: { readonly store: RolesStore }) => {
  const vm = useStore(store, (state) => state.vm);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return <RolesView vm={vm} {...buildActions(store)} />;
};

export const RolesSection = () => {
  const store = useRolesStore();
  if (!store) return null;
  return <RolesBound store={store} />;
};
