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

/**
 * `getCoverage` (ADR-0018 read model) — the one billing read the directory,
 * the org-detail card and the ledger view all share. Loads the subscription
 * facts + the charge ledger and derives paid-through / balance / phase / dormant
 * via the domain; nothing is stored, so the views cannot disagree. Gated by
 * `billing.read` (customer `own` — delegable — and staff `any`).
 */
export const makeGetCoverage =
  (deps: BillingLedgerDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): Promise<Result<Coverage, BillingLedgerUseCaseError>> => {
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
    const coverage = deriveCoverage({
      subscription: sub,
      charges,
      currency: deps.policy.currency,
      now,
      policy: { dormantDays: deps.policy.dormantDays },
    });
    return ok(coverage);
  };

export type {
  RecordPaymentInput,
  CreditAccountInput,
} from './mutations/record-payment';
export type { ReversePaymentInput } from './mutations/reverse-payment';
export type { GenerateChargesInput } from './mutations/generate-charges';
export {
  makeRecordPayment,
  makeCreditAccount,
  makeRefundPayment,
  makeVoidPayment,
  makeGenerateCharges,
};

export type BillingLedgerUseCases = {
  readonly getCoverage: ReturnType<typeof makeGetCoverage>;
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
  recordPayment: makeRecordPayment(deps),
  creditAccount: makeCreditAccount(deps),
  voidPayment: makeVoidPayment(deps),
  refundPayment: makeRefundPayment(deps),
  generateCharges: makeGenerateCharges(deps),
});
