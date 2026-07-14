import type { Charge, CurrencyCode, Payment } from '@acme/domain';
import type { Clock } from '@acme/shared';
import type { PlanCatalogStore } from '../billing-plans/ports';
import type { SubscriptionStore } from '../billing-subscriptions/ports';

/**
 * The manual-billing ledger stores (ADR-0018) — append-only Charges + Payments.
 * Coverage/balance/phase are DERIVED from them (never stored), so the stores
 * only persist facts. Subscriptions live in the billing-subscriptions store,
 * reused here for the anchor/trial/cancel facts `deriveCoverage` needs.
 */

export type ChargeStore = {
  readonly listByAccount: (accountId: string) => Promise<readonly Charge[]>;
  /** Upsert by charge id (settlement rewrites a charge's status/coveredThrough). */
  readonly saveMany: (charges: readonly Charge[]) => Promise<void>;
};

export type PaymentStore = {
  readonly listByAccount: (accountId: string) => Promise<readonly Payment[]>;
  readonly findById: (paymentId: string) => Promise<Payment | null>;
  readonly append: (payment: Payment) => Promise<void>;
};

/**
 * Global manual-billing policy — the values snapshotted onto each charge and
 * used by coverage derivation. Global to start (ADR-0018); per-plan/per-org and
 * per-currency taxes come later. `currency` is the single ledger currency.
 */
export type BillingLedgerPolicy = {
  readonly dormantDays: number;
  readonly graceDays: number;
  readonly currency: CurrencyCode;
  readonly taxRateBps: number;
};

export type BillingLedgerDeps = {
  readonly subscriptions: Pick<SubscriptionStore, 'findByAccount'>;
  /** For the fresh charge a beyond-cap payment starts (plan price snapshot). */
  readonly plans: Pick<PlanCatalogStore, 'findPlanById'>;
  readonly charges: ChargeStore;
  readonly payments: PaymentStore;
  readonly clock: Clock;
  readonly ids: () => string;
  readonly policy: BillingLedgerPolicy;
};
