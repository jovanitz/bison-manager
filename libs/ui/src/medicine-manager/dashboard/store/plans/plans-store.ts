import { createStore } from 'zustand/vanilla';
import { loadPlansCatalog } from '@acme/application';
import type { PlansVM } from '../../plans/plans.types';
import { blankDraft, toPlansVM } from './plans-vm';
import {
  closeOverlays,
  patchVm,
  type Ctx,
  type PlansStoreDeps,
  type PlansStoreState,
} from './plans-store.internals';
import {
  confirmEdit,
  confirmReset,
  confirmRetire,
  confirmSetDefault,
  openEdit,
  openReset,
  openRetire,
  openSetDefault,
  submitForm,
} from './plans-store.actions';

export type { PlansStoreDeps, PlansStoreState } from './plans-store.internals';

/**
 * Reactive store for the staff Plans catalog (ADR-0016, ADR-0017 giro-owned).
 * `load` runs the headless `loadPlansCatalog` flow (gated by `plans.manage`) and
 * maps it to the VM; every lever (create / edit → blast-radius / retire / reset
 * / set-default) dispatches to the billing gateway and reloads. Overlay state is
 * VM data; orchestration lives here, never in the container.
 */
const LOADING: PlansVM = { plans: [], loading: true, canManage: false };

const buildLoad = (ctx: Ctx) => async (): Promise<void> => {
  const result = await loadPlansCatalog({
    access: ctx.deps.access,
    billing: ctx.deps.billing,
  });
  if (!result.ok) {
    ctx.set({
      vm: {
        plans: [],
        loading: false,
        canManage: false,
        error: result.error.message,
      },
    });
    return;
  }
  ctx.catalog = result.value.plans;
  ctx.set({ vm: toPlansVM(result.value) });
};

export const createPlansStore = (deps: PlansStoreDeps) =>
  createStore<PlansStoreState>((set, get) => {
    const ctx: Ctx = {
      deps,
      set,
      get,
      reload: () => Promise.resolve(),
      edit: null,
      catalog: [],
    };
    ctx.reload = buildLoad(ctx);
    return {
      vm: LOADING,
      load: ctx.reload,
      openCreate: () =>
        patchVm(ctx, {
          form: { mode: 'create', planId: null, draft: blankDraft },
        }),
      openEdit: openEdit(ctx),
      cancelForm: () => closeOverlays(ctx),
      submitForm: submitForm(ctx),
      confirmEdit: confirmEdit(ctx),
      cancelEdit: () => closeOverlays(ctx),
      openRetire: openRetire(ctx),
      confirmRetire: confirmRetire(ctx),
      cancelRetire: () => closeOverlays(ctx),
      openReset: openReset(ctx),
      confirmReset: confirmReset(ctx),
      cancelReset: () => closeOverlays(ctx),
      openSetDefault: openSetDefault(ctx),
      confirmSetDefault: confirmSetDefault(ctx),
      cancelSetDefault: () => closeOverlays(ctx),
    };
  });

export type PlansStore = ReturnType<typeof createPlansStore>;
