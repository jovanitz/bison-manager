import { type Result, err, ok } from '@acme/shared';
import type { AccessClientUseCases } from '../../../access-client/use-cases';
import type {
  BillingGateway,
  PlanDto,
} from '../../../access-client/billing-ports';
import { holdsAction } from '../../capabilities';
import type { DashboardError } from '../queries';

/** The staff plan-catalog screen: every plan + whether the actor may manage. */
export type PlansCatalogViewModel = {
  readonly plans: ReadonlyArray<PlanDto>;
  readonly canManage: boolean;
};

/**
 * Loads the FULL plan catalog (hidden and retired included) for the staff
 * plans screen. The list itself is gated by `plans.manage` (hidden plan names
 * encode who got special terms), so without it the flow short-circuits to the
 * gated view-model — it never even calls the API. Each plan is enriched with
 * its subscriber count via `plans.subscribers`; a count failure must not sink
 * the catalog — that plan simply carries no count.
 */
export const loadPlansCatalog = async (deps: {
  readonly access: AccessClientUseCases;
  readonly billing: Pick<BillingGateway, 'listPlans' | 'listSubscribers'>;
}): Promise<Result<PlansCatalogViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const canManage = holdsAction(snapshot.value, 'plans.manage');
  if (!canManage) return ok({ plans: [], canManage });

  const listed = await deps.billing.listPlans();
  if (!listed.ok) return err(listed.error);

  const plans = await Promise.all(
    listed.value.map(async (plan): Promise<PlanDto> => {
      const subscribed = await deps.billing.listSubscribers(plan.id);
      return subscribed.ok
        ? { ...plan, subscribers: subscribed.value.length }
        : plan;
    }),
  );
  return ok({ plans, canManage });
};
