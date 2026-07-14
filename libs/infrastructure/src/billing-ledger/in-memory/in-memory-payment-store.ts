import type { PaymentStore } from '@acme/application';
import type { Payment } from '@acme/domain';

/**
 * In-memory {@link PaymentStore} — the reference the Postgres adapter is
 * contract-tested against. Append-only: corrections are new compensating rows,
 * never edits.
 */
export const createInMemoryPaymentStore = (): PaymentStore => {
  let rows: readonly Payment[] = [];
  return {
    listByAccount: async (accountId) =>
      rows.filter((p) => p.accountId === accountId),
    findById: async (paymentId) => rows.find((p) => p.id === paymentId) ?? null,
    append: async (payment) => {
      rows = [...rows, payment];
    },
  };
};
