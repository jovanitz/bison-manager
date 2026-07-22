import { z } from 'zod';
import { ok } from '@acme/shared';
import type { BillingLedgerUseCases } from '@acme/application';
import { defineApiProcedure } from '../../../rpc/procedure';
import type { ApiProcedure } from '../../../rpc/procedure';
import { reasonSchema } from '../schemas';

/**
 * The billing LEDGER surface the org-detail Ledger card + its void/refund
 * correction menu consume (ADR-0018). The read (`billing.ledger`) lists the
 * charges + payments with a running balance; the corrections are append-only
 * compensating entries with a mandatory audited reason. All three reauthorize in
 * the use case (the pipeline does not enforce `action`); a void/refund returns
 * void — the client re-reads coverage + ledger, so the card and the ledger
 * (two views of one derivation) can never disagree.
 */
const reversalInput = z
  .object({ paymentId: z.string().min(1), reason: reasonSchema })
  .strict();

export const createLedgerProcedures = (
  ledger: BillingLedgerUseCases,
): ReadonlyArray<ApiProcedure> => [
  defineApiProcedure({
    name: 'billing.ledger',
    summary:
      "List one org's billing ledger: charges + payments in order, each with " +
      'its signed amount and the running balance (ADR-0018).',
    action: 'billing.read',
    input: z.object({ accountId: z.string().min(1) }).strict(),
    handler: async ({ actor, input }) =>
      ledger.listLedger({ actor, accountId: input.accountId }),
  }),
  defineApiProcedure({
    name: 'billing.void',
    summary:
      'Void a payment recorded by mistake — as if it never happened; reopens ' +
      'the charges it settled (ADR-0018). Mandatory reason.',
    action: 'plans.manage',
    input: reversalInput,
    handler: async ({ actor, input }) => {
      const result = await ledger.voidPayment({
        actor,
        paymentId: input.paymentId,
        reason: input.reason,
      });
      return result.ok ? ok(undefined) : result;
    },
  }),
  defineApiProcedure({
    name: 'billing.refund',
    summary:
      'Refund a payment — money actually returned to the customer; reopens the ' +
      'charges it settled (ADR-0018). Mandatory reason.',
    action: 'plans.manage',
    input: reversalInput,
    handler: async ({ actor, input }) => {
      const result = await ledger.refundPayment({
        actor,
        paymentId: input.paymentId,
        reason: input.reason,
      });
      return result.ok ? ok(undefined) : result;
    },
  }),
];
