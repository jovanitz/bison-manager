import { type Result, err, ok } from '@acme/shared';
import { deriveCoverage, makeAccountId } from '@acme/domain';
import type { AccessActor, Coverage } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { subscriptionNotFound } from '../billing-subscriptions/errors';
import type { BillingLedgerUseCaseError } from './errors';
import type { BillingLedgerDeps } from './ports';
import {
  makeCreditAccount,
  makeRecordPayment,
} from './mutations/record-payment';
import {
  makeRefundPayment,
  makeVoidPayment,
} from './mutations/reverse-payment';
import { makeGenerateCharges } from './mutations/generate-charges';
import { makeListLedger } from './queries/list-ledger';

/**
 * `getCoverage` (ADR-0018 read model) — the one billing read the directory,
 * the org-detail card and the ledger view all share. Loads the subscription
 * facts + the charge ledger and derives paid-through / balance / phase / dormant
 * via the domain; nothing is stored, so the views cannot disagree. Gated by
 * `billing.read` (customer `own` — delegable — and staff `any`).
 */
/**
 * Coverage plus the SUBSCRIBED PLAN's display name. The plan is not part of the
 * domain `Coverage` (which is pure billing math), but every consumer that shows
 * coverage also shows the plan, and the subscription is already loaded here —
 * so resolving it once avoids a second round trip per org in the directory.
 */
export type AccountCoverage = {
  readonly coverage: Coverage;
  readonly planName: string | null;
};

export const makeGetCoverage =
  (deps: BillingLedgerDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<Result<AccountCoverage, BillingLedgerUseCaseError>> => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'billing.read',
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const sub = await deps.subscriptions.findByAccount(accountId.value);
    if (!sub)
      return err(
        subscriptionNotFound(`No subscription for ${accountId.value}.`),
      );

    const charges = await deps.charges.listByAccount(accountId.value);
    const plan = await deps.plans.findPlanById(sub.planId);
    const coverage = deriveCoverage({
      subscription: sub,
      charges,
      currency: deps.policy.currency,
      now,
      policy: { dormantDays: deps.policy.dormantDays },
    });
    return ok({ coverage, planName: plan?.displayName ?? null });
  };

export type {
  RecordPaymentInput,
  CreditAccountInput,
} from './mutations/record-payment';
export type { ReversePaymentInput } from './mutations/reverse-payment';
export type { GenerateChargesInput } from './mutations/generate-charges';
export type { AccountLedgerView, LedgerEntryView } from './queries/list-ledger';
export {
  makeRecordPayment,
  makeCreditAccount,
  makeRefundPayment,
  makeVoidPayment,
  makeGenerateCharges,
  makeListLedger,
};

export type BillingLedgerUseCases = {
  readonly getCoverage: ReturnType<typeof makeGetCoverage>;
  readonly listLedger: ReturnType<typeof makeListLedger>;
  readonly recordPayment: ReturnType<typeof makeRecordPayment>;
  readonly creditAccount: ReturnType<typeof makeCreditAccount>;
  readonly voidPayment: ReturnType<typeof makeVoidPayment>;
  readonly refundPayment: ReturnType<typeof makeRefundPayment>;
  readonly generateCharges: ReturnType<typeof makeGenerateCharges>;
};

export const makeBillingLedgerUseCases = (
  deps: BillingLedgerDeps,
): BillingLedgerUseCases => ({
  getCoverage: makeGetCoverage(deps),
  listLedger: makeListLedger(deps),
  recordPayment: makeRecordPayment(deps),
  creditAccount: makeCreditAccount(deps),
  voidPayment: makeVoidPayment(deps),
  refundPayment: makeRefundPayment(deps),
  generateCharges: makeGenerateCharges(deps),
});
