import { deriveCoverage } from '@acme/domain';
import type { Coverage } from '@acme/domain';
import type { Clock } from '@acme/shared';
import type {
  CoverageDto,
  CoverageReader,
} from '../flows/dashboard/directory/directory';
import type { SubscriptionStore } from '../billing-subscriptions/ports';
import type { BillingLedgerPolicy, ChargeStore } from './ports';

/** Flatten the domain `Coverage` read model to the UI-facing `CoverageDto`. */
export const coverageToDto = (coverage: Coverage): CoverageDto => ({
  phase: coverage.phase,
  dormant: coverage.dormant,
  balanceMinor: coverage.balance.minor,
  currency: coverage.balance.currency,
  paidThroughAt: coverage.paidThroughAt,
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
    return coverageToDto(
      deriveCoverage({
        subscription: sub,
        charges,
        currency: deps.policy.currency,
        now: deps.clock.now().toISOString(),
        policy: { dormantDays: deps.policy.dormantDays },
      }),
    );
  },
});
