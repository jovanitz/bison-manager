import type { OrgPaymentRow } from '../org-detail.types';

/** Demo ledger — one of each status, newest first (pending on top invites Mark as paid). */
export const demoPayments: readonly OrgPaymentRow[] = [
  {
    paymentId: 'pay_4',
    period: 'Jul 2026',
    amountLabel: '$49.00',
    status: 'pending',
    paidAt: null,
  },
  {
    paymentId: 'pay_3',
    period: 'Jun 2026',
    amountLabel: '$49.00',
    status: 'paid',
    paidAt: '2026-06-03',
  },
  {
    paymentId: 'pay_2',
    period: 'May 2026',
    amountLabel: '$49.00',
    status: 'failed',
    paidAt: null,
  },
  {
    paymentId: 'pay_1',
    period: 'Apr 2026',
    amountLabel: '$49.00',
    status: 'refunded',
    paidAt: '2026-04-10',
  },
];
