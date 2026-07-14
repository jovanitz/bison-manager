import { type Result, err, ok } from '@acme/shared';
import { deriveCoverage, makeAccountId, makePaymentId } from '@acme/domain';
import type { AccessActor, Charge, Coverage, Payment } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import { subscriptionNotFound } from '../../billing-subscriptions/errors';
import { paymentNotFound } from '../errors';
import type { BillingLedgerUseCaseError } from '../errors';
import type { BillingLedgerDeps } from '../ports';

export type ReversePaymentInput = {
  readonly actor: AccessActor;
  readonly paymentId: string;
  readonly reason: string;
};

/**
 * Corrections are append-only compensating entries (ADR-0018 Decision 5), never
 * edits. `void` = a payment that never really happened (mistake); `refund` =
 * money actually returned. Both reopen the charges the original payment settled
 * so coverage recomputes DOWN — the difference is the accounting record (an
 * egress) the tag carries. Both need a mandatory reason and `plans.manage`.
 */
const reopen = (
  charges: readonly Charge[],
  appliedTo: readonly string[],
): readonly Charge[] =>
  charges
    .filter((c) => c.status === 'paid' && appliedTo.includes(c.id))
    .map((c) => ({
      ...c,
      status: 'open' as const,
      paidAt: null,
      coveredThrough: null,
    }));

const buildReversal = (input: {
  readonly ids: () => string;
  readonly kind: 'void' | 'refund';
  readonly target: Payment;
  readonly actor: AccessActor;
  readonly reason: string;
  readonly now: string;
}): Result<Payment, BillingLedgerUseCaseError> => {
  const id = makePaymentId(input.ids());
  if (!id.ok) return err(id.error);
  return ok({
    id: id.value,
    accountId: input.target.accountId,
    kind: input.kind,
    amount: input.target.amount,
    appliedTo: [],
    reversalOf: input.target.id,
    recordedByMembershipId: input.actor.membership.id,
    reason: input.reason,
    occurredAt: input.now,
  });
};

const makeReverse =
  (kind: 'void' | 'refund') =>
  (deps: BillingLedgerDeps) =>
  async (
    input: ReversePaymentInput,
  ): Promise<Result<Coverage, BillingLedgerUseCaseError>> => {
    const now = deps.clock.now().toISOString();
    const target = await deps.payments.findById(input.paymentId);
    if (!target || target.kind !== 'payment')
      return err(paymentNotFound(`No reversible payment ${input.paymentId}.`));
    const accountId = makeAccountId(target.accountId);
    if (!accountId.ok) return err(accountId.error);

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'plans.manage',
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const reversal = buildReversal({
      ids: deps.ids,
      kind,
      target,
      actor: input.actor,
      reason: input.reason,
      now,
    });
    if (!reversal.ok) return err(reversal.error);
    await deps.payments.append(reversal.value);

    const charges = await deps.charges.listByAccount(target.accountId);
    await deps.charges.saveMany(reopen(charges, target.appliedTo));

    const sub = await deps.subscriptions.findByAccount(target.accountId);
    if (!sub)
      return err(
        subscriptionNotFound(`No subscription for ${target.accountId}.`),
      );
    const after = await deps.charges.listByAccount(target.accountId);
    return ok(
      deriveCoverage({
        subscription: sub,
        charges: after,
        currency: deps.policy.currency,
        now,
        policy: { dormantDays: deps.policy.dormantDays },
      }),
    );
  };

export const makeVoidPayment = makeReverse('void');
export const makeRefundPayment = makeReverse('refund');
