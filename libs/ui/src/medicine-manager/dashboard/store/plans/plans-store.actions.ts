import {
  buildBlast,
  findRow,
  patchVm,
  runOverlay,
  type Ctx,
} from './plans-store.internals';
import {
  draftFromRow,
  draftToChanges,
  draftToCreateDto,
  toPlanRow,
} from './plans-vm';
import type { PlanDraft } from '../../plans/plans.types';

/**
 * The Plans store's action builders — each takes the working `Ctx` and returns
 * the dispatcher the store exposes. Reads open an overlay (VM data); mutations
 * call the billing gateway through `runOverlay` and reload on success. Every
 * mutating call carries its audited `reason` as a real argument (never
 * synthesized) — the exact same contract a prompt-driven agent would feed.
 */

export const openEdit =
  (ctx: Ctx) =>
  (planId: string): void => {
    const dto = ctx.catalog.find((d) => d.id === planId);
    if (!dto) return;
    const row = toPlanRow(dto);
    patchVm(ctx, {
      form: {
        mode: 'edit',
        planId,
        draft: draftFromRow(row),
        subscribers: row.subscribers,
      },
    });
  };

const createPlan = (
  ctx: Ctx,
  draft: PlanDraft,
  reason: string,
): Promise<void> => {
  const form = ctx.get().vm.form;
  if (!form) return Promise.resolve();
  return runOverlay(
    ctx,
    (busy, error) =>
      patchVm(ctx, { form: { ...form, submitting: busy, error } }),
    () => ctx.deps.billing.createPlan(draftToCreateDto(draft, reason)),
  );
};

export const submitForm =
  (ctx: Ctx) =>
  async (draft: PlanDraft, reason?: string): Promise<void> => {
    const form = ctx.get().vm.form;
    if (!form) return;
    if (form.mode === 'create') {
      await createPlan(ctx, draft, reason ?? '');
      return;
    }
    const dto = ctx.catalog.find((d) => d.id === form.planId);
    if (!dto) return;
    const preview = await ctx.deps.billing.previewPlanUpdate({
      planId: dto.id,
      changes: draftToChanges(draft),
    });
    ctx.edit = { planId: dto.id, expectedVersion: dto.version, draft };
    patchVm(ctx, {
      form: undefined,
      pendingEdit: buildBlast(
        toPlanRow(dto),
        draft,
        preview.ok ? preview.value : null,
      ),
    });
  };

export const confirmEdit =
  (ctx: Ctx) =>
  async (reason: string): Promise<void> => {
    const pending = ctx.get().vm.pendingEdit;
    const edit = ctx.edit;
    if (!pending || !edit) return;
    await runOverlay(
      ctx,
      (busy, error) =>
        patchVm(ctx, { pendingEdit: { ...pending, confirming: busy, error } }),
      () =>
        ctx.deps.billing.updatePlan({
          planId: edit.planId,
          changes: draftToChanges(edit.draft),
          expectedVersion: edit.expectedVersion,
          reason,
        }),
    );
  };

export const openRetire =
  (ctx: Ctx) =>
  (planId: string): void => {
    const row = findRow(ctx, planId);
    if (row)
      patchVm(ctx, {
        pendingRetire: {
          planId,
          displayName: row.displayName,
          subscribers: row.subscribers,
        },
      });
  };

export const confirmRetire =
  (ctx: Ctx) =>
  async (reason: string): Promise<void> => {
    const pending = ctx.get().vm.pendingRetire;
    if (!pending) return;
    await runOverlay(
      ctx,
      (busy, error) =>
        patchVm(ctx, { pendingRetire: { ...pending, retiring: busy, error } }),
      () => ctx.deps.billing.retirePlan({ planId: pending.planId, reason }),
    );
  };

export const openReset =
  (ctx: Ctx) =>
  (planId: string): void => {
    const row = findRow(ctx, planId);
    if (row)
      patchVm(ctx, {
        pendingReset: {
          planId,
          displayName: row.displayName,
          subscribers: row.subscribers,
        },
      });
  };

export const confirmReset =
  (ctx: Ctx) =>
  async (reason: string): Promise<void> => {
    const pending = ctx.get().vm.pendingReset;
    if (!pending) return;
    await runOverlay(
      ctx,
      (busy, error) =>
        patchVm(ctx, { pendingReset: { ...pending, resetting: busy, error } }),
      () => ctx.deps.billing.resetPlan({ planId: pending.planId, reason }),
    );
  };

export const openSetDefault =
  (ctx: Ctx) =>
  (planId: string): void => {
    const row = findRow(ctx, planId);
    const current = ctx.get().vm.plans.find((p) => p.isDefault);
    if (row)
      patchVm(ctx, {
        pendingSetDefault: {
          planId,
          displayName: row.displayName,
          currentDefaultName: current?.displayName ?? null,
        },
      });
  };

export const confirmSetDefault =
  (ctx: Ctx) =>
  async (reason: string): Promise<void> => {
    const pending = ctx.get().vm.pendingSetDefault;
    if (!pending) return;
    await runOverlay(
      ctx,
      (busy, error) =>
        patchVm(ctx, {
          pendingSetDefault: { ...pending, setting: busy, error },
        }),
      () => ctx.deps.billing.setDefaultPlan({ planId: pending.planId, reason }),
    );
  };
