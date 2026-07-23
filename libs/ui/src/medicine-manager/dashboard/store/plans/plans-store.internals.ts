import type {
  AccessClientUseCases,
  BillingGateway,
  PlanDto,
  PlanImpactPreviewDto,
} from '@acme/application';
import type { Result } from '@acme/shared';
import { planChangeLines, priceRaised } from '../../plans/review/diff';
import type {
  BlastRadiusVM,
  PlanDraft,
  PlanRow,
  PlansVM,
} from '../../plans/plans.types';

/**
 * Shared types + helpers for the Plans store, kept in a dependency-free base so
 * `plans-store.ts` (the factory) and `plans-store.actions.ts` (the mutation
 * builders) both import from here without a cycle. The store owns the overlay
 * state (which dialog is open) as VM data; the raw `catalog` DTOs and the CAS
 * `version` live off-VM in `Ctx` — the view never sees them.
 */

export type PlansStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly billing: BillingGateway;
};

/** The edit held between the blast-radius preview and the CAS-guarded commit. */
export type EditCtx = {
  readonly planId: string;
  readonly expectedVersion: number;
  readonly draft: PlanDraft;
};

export type PlansStoreState = {
  readonly vm: PlansVM;
  readonly load: () => Promise<void>;
  readonly openCreate: () => void;
  readonly openEdit: (planId: string) => void;
  readonly cancelForm: () => void;
  readonly submitForm: (draft: PlanDraft, reason?: string) => Promise<void>;
  readonly confirmEdit: (reason: string) => Promise<void>;
  readonly cancelEdit: () => void;
  readonly openRetire: (planId: string) => void;
  readonly confirmRetire: (reason: string) => Promise<void>;
  readonly cancelRetire: () => void;
  readonly openReset: (planId: string) => void;
  readonly confirmReset: (reason: string) => Promise<void>;
  readonly cancelReset: () => void;
  readonly openSetDefault: (planId: string) => void;
  readonly confirmSetDefault: (reason: string) => Promise<void>;
  readonly cancelSetDefault: () => void;
};

/** The private working context threaded through the action builders. */
export type Ctx = {
  readonly deps: PlansStoreDeps;
  readonly set: (partial: Partial<PlansStoreState>) => void;
  readonly get: () => PlansStoreState;
  reload: () => Promise<void>;
  edit: EditCtx | null;
  catalog: readonly PlanDto[];
};

export const patchVm = (ctx: Ctx, partial: Partial<PlansVM>): void =>
  ctx.set({ vm: { ...ctx.get().vm, ...partial } });

/** Clear every overlay at once — the single-dialog invariant on close/success. */
export const closeOverlays = (ctx: Ctx): void =>
  patchVm(ctx, {
    form: undefined,
    pendingEdit: undefined,
    pendingRetire: undefined,
    pendingReset: undefined,
    pendingSetDefault: undefined,
  });

export const findRow = (ctx: Ctx, planId: string): PlanRow | undefined =>
  ctx.get().vm.plans.find((p) => p.planId === planId);

/**
 * The busy → await → (close + reload) | (inline error) pattern every plan
 * mutation shares. `patch` writes the busy/error flags onto the open overlay's
 * VM so the dialog spins and, on failure, surfaces the message for a retry.
 */
export const runOverlay = async (
  ctx: Ctx,
  patch: (busy: boolean, error?: string) => void,
  call: () => Promise<Result<unknown, { readonly message: string }>>,
): Promise<void> => {
  patch(true);
  const result = await call();
  if (result.ok) {
    closeOverlays(ctx);
    await ctx.reload();
  } else {
    patch(false, result.error.message);
  }
};

/**
 * Assemble the blast-radius VM from the server preview (WHO it reaches) plus the
 * client-side before→after diff (WHAT changed) — the application can't build a
 * UI type, so the store bridges them. A failed preview degrades to the diff.
 */
export const buildBlast = (
  before: PlanRow,
  draft: PlanDraft,
  preview: PlanImpactPreviewDto | null,
): BlastRadiusVM => ({
  planName: draft.displayName,
  subscribers: preview?.subscribers ?? before.subscribers,
  changes: planChangeLines(before, draft),
  wouldGoOverLimit: preview?.wouldGoOverLimit ?? 0,
  wouldLoseFeature: preview?.wouldLoseFeature ?? 0,
  priceRaised: priceRaised(before.price, draft.price),
});
