import { deriveCoverage } from '@acme/domain';
import type { Coverage } from '@acme/domain';
import type { Clock } from '@acme/shared';
import type {
  CoverageDto,
  CoverageReader,
} from '../flows/dashboard/directory/directory';
import type { PlanCatalogStore } from '../billing-plans/ports';
import type { SubscriptionStore } from '../billing-subscriptions/ports';
import type { BillingLedgerPolicy, ChargeStore } from './ports';

/**
 * Flatten the domain `Coverage` read model to the UI-facing `CoverageDto`. The
 * plan rides alongside (it is not billing math, so the domain does not carry
 * it) — see `AccountCoverage`.
 */
export const coverageToDto = (
  coverage: Coverage,
  planName: string | null,
): CoverageDto => ({
  phase: coverage.phase,
  dormant: coverage.dormant,
  balanceMinor: coverage.balance.minor,
  currency: coverage.balance.currency,
  paidThroughAt: coverage.paidThroughAt,
  plan: planName,
});

/**
 * Assembles the `CoverageReader` gateway the Directory/org-detail flows consume:
 * loads the subscription facts + the charge ledger and derives coverage (the
 * same domain `deriveCoverage` as `getCoverage`), then FLATTENS it to a
 * `CoverageDto` so the UI never touches domain types. `null` when the account
 * has no subscription. Framework-free — the composition root passes the pg
 * (or in-memory) stores; authorization already happened at the flow level.
 */
export type CoverageReaderDeps = {
  readonly subscriptions: Pick<SubscriptionStore, 'findByAccount'>;
  readonly charges: Pick<ChargeStore, 'listByAccount'>;
  readonly plans: Pick<PlanCatalogStore, 'findPlanById'>;
  readonly clock: Clock;
  readonly policy: Pick<BillingLedgerPolicy, 'currency' | 'dormantDays'>;
};

export const makeCoverageReader = (
  deps: CoverageReaderDeps,
): CoverageReader => ({
  coverageFor: async (accountId): Promise<CoverageDto | null> => {
    const sub = await deps.subscriptions.findByAccount(accountId);
    if (!sub) return null;
    const charges = await deps.charges.listByAccount(accountId);
    const plan = await deps.plans.findPlanById(sub.planId);
    return coverageToDto(
      deriveCoverage({
        subscription: sub,
        charges,
        currency: deps.policy.currency,
        now: deps.clock.now().toISOString(),
        policy: { dormantDays: deps.policy.dormantDays },
      }),
      plan?.displayName ?? null,
    );
  },
});
