import { useEffect } from 'react';
import { usePlansStore, useStore } from '../store/hooks';
import type { PlansStore } from '../store/plans/plans-store';
import { PlansView } from './plans.view';
import type { PlansActions } from './plans.types';

/**
 * The DI-bound Plans container (ADR-0016, ADR-0017 giro-owned). Reads the
 * ViewModel from the store and dispatches every lever to it: create / edit
 * (blast-radius) / retire / reset / set-default — each carrying its audited
 * reason as a real argument. No orchestration lives here; it only wires the
 * pure `PlansView` to the store, which owns the flow. Loads on mount, and the
 * `plans.manage` gate is enforced server-side (the flow returns an empty
 * catalog without it), so a viewer without it simply sees no manage levers.
 */
const buildActions = (store: PlansStore): PlansActions => {
  const state = () => store.getState();
  return {
    onCreate: () => state().openCreate(),
    onEdit: (id) => state().openEdit(id),
    onReset: (id) => state().openReset(id),
    onRetire: (id) => state().openRetire(id),
    onSetDefault: (id) => state().openSetDefault(id),
    onSubmitForm: (draft, reason) => void state().submitForm(draft, reason),
    onCancelForm: () => state().cancelForm(),
    onConfirmEdit: (reason) => void state().confirmEdit(reason),
    onCancelEdit: () => state().cancelEdit(),
    onConfirmRetire: (reason) => void state().confirmRetire(reason),
    onCancelRetire: () => state().cancelRetire(),
    onConfirmReset: (reason) => void state().confirmReset(reason),
    onCancelReset: () => state().cancelReset(),
    onConfirmSetDefault: (reason) => void state().confirmSetDefault(reason),
    onCancelSetDefault: () => state().cancelSetDefault(),
  };
};

const PlansBound = ({ store }: { readonly store: PlansStore }) => {
  const vm = useStore(store, (state) => state.vm);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return <PlansView vm={vm} {...buildActions(store)} />;
};

export const PlansSection = () => {
  const store = usePlansStore();
  if (!store) return null;
  return <PlansBound store={store} />;
};
