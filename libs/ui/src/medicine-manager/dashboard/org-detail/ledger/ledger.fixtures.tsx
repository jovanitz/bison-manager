import type { OrgLedgerEntry } from '../org-detail.types';

/**
 * Demo statement for a healthy (paid-up) Pro org — three months of $49 net
 * charges (+ 16% IVA = $56.84) each settled a few days later, newest first.
 * Each row's `balanceLabel` is the account balance right after that movement,
 * so the top row shows the current balance ($0.00 — paid up). Payment rows
 * carry the ⋯ void/refund correction menu.
 */
const TAX_NOTE = '$49.00 + $7.84 IVA';

export const demoLedger: readonly OrgLedgerEntry[] = [
  {
    id: 'l6',
    date: '2026-07-08',
    kind: 'payment',
    description: 'Payment received',
    amountLabel: '−$56.84',
    balanceLabel: '$0.00',
  },
  {
    id: 'l5',
    date: '2026-07-05',
    kind: 'charge',
    description: 'Jul 2026',
    amountLabel: '+$56.84',
    balanceLabel: '$56.84',
    chargeStatus: 'paid',
    taxNote: TAX_NOTE,
  },
  {
    id: 'l4',
    date: '2026-06-08',
    kind: 'payment',
    description: 'Payment received',
    amountLabel: '−$56.84',
    balanceLabel: '$0.00',
  },
  {
    id: 'l3',
    date: '2026-06-05',
    kind: 'charge',
    description: 'Jun 2026',
    amountLabel: '+$56.84',
    balanceLabel: '$56.84',
    chargeStatus: 'paid',
    taxNote: TAX_NOTE,
  },
  {
    id: 'l2',
    date: '2026-05-08',
    kind: 'payment',
    description: 'Payment received',
    amountLabel: '−$56.84',
    balanceLabel: '$0.00',
  },
  {
    id: 'l1',
    date: '2026-05-05',
    kind: 'charge',
    description: 'May 2026',
    amountLabel: '+$56.84',
    balanceLabel: '$56.84',
    chargeStatus: 'paid',
    taxNote: TAX_NOTE,
  },
];

/**
 * A suspended org's statement — the current Jul charge is still OPEN (unpaid),
 * so the running balance stays at $56.84 owed. Shows an over-limit correction
 * too: an earlier duplicate payment was voided (append-only, reason recorded).
 */
export const demoLedgerOwing: readonly OrgLedgerEntry[] = [
  {
    id: 'o4',
    date: '2026-07-05',
    kind: 'charge',
    description: 'Jul 2026',
    amountLabel: '+$56.84',
    balanceLabel: '$56.84',
    chargeStatus: 'open',
    taxNote: TAX_NOTE,
  },
  {
    id: 'o3',
    date: '2026-06-10',
    kind: 'void',
    description: 'Void · payment',
    amountLabel: '+$56.84',
    balanceLabel: '$56.84',
    reason: 'Duplicate entry — wrong org',
  },
  {
    id: 'o2',
    date: '2026-06-08',
    kind: 'payment',
    description: 'Payment received',
    amountLabel: '−$56.84',
    balanceLabel: '$0.00',
  },
  {
    id: 'o1',
    date: '2026-06-05',
    kind: 'charge',
    description: 'Jun 2026',
    amountLabel: '+$56.84',
    balanceLabel: '$56.84',
    chargeStatus: 'paid',
    taxNote: TAX_NOTE,
  },
];
