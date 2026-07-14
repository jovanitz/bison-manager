/**
 * Billing ledger for the Org Detail view (ADR-0018 Decision 1) — a statement:
 * charges and payments as movements with a running balance, the source of truth
 * behind the subscription card. Replaces the old paid/pending/failed/refunded
 * model — there is no processor, so `failed` does not exist; corrections are
 * append-only (void / refund), never edits.
 */
import { Badge, type BadgeProps } from '../../../../design-system/badge/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../design-system/card/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../design-system/table/table';
import type {
  ChargeStatus,
  LedgerEntryKind,
  OrgBalance,
  OrgLedgerEntry,
} from '../org-detail.types';
import { LedgerRowActions } from './ledger-actions';

const BALANCE_TONE: Record<OrgBalance['state'], string> = {
  owes: 'text-destructive',
  clear: 'text-muted-foreground',
  credit: 'text-success',
};
const BALANCE_LABEL: Record<OrgBalance['state'], (label: string) => string> = {
  owes: (label) => `Owes ${label}`,
  clear: () => 'Paid up',
  credit: (label) => `Credit ${label}`,
};

const CHARGE_STATUS: Record<
  ChargeStatus,
  { readonly variant: BadgeProps['variant']; readonly label: string }
> = {
  open: { variant: 'warning', label: 'Open' },
  paid: { variant: 'success', label: 'Paid' },
  void: { variant: 'secondary', label: 'Void' },
};

/** Money direction: payments/credits reduce the balance (green); refunds raise
 *  it (red); a voided movement is struck through; a charge is neutral. */
const AMOUNT_CLASS: Record<LedgerEntryKind, string> = {
  payment: 'text-success',
  credit: 'text-success',
  refund: 'text-destructive',
  void: 'text-muted-foreground line-through',
  charge: 'text-foreground',
};

const Movement = ({ entry }: { readonly entry: OrgLedgerEntry }) => (
  <div className="flex flex-col">
    <span className="font-medium text-foreground">{entry.description}</span>
    {entry.taxNote ? (
      <span className="text-xs text-muted-foreground">{entry.taxNote}</span>
    ) : null}
    {entry.reason ? (
      <span className="text-xs italic text-muted-foreground">
        {entry.reason}
      </span>
    ) : null}
  </div>
);

const LedgerRow = ({
  entry,
  canManageBilling,
  onVoidPayment,
  onRefundPayment,
}: {
  readonly entry: OrgLedgerEntry;
  readonly canManageBilling: boolean;
  readonly onVoidPayment: (entryId: string, reason: string) => void;
  readonly onRefundPayment: (entryId: string, reason: string) => void;
}) => (
  <TableRow>
    <TableCell className="whitespace-nowrap align-top text-muted-foreground">
      {entry.date}
    </TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        <Movement entry={entry} />
        {entry.chargeStatus ? (
          <Badge
            variant={CHARGE_STATUS[entry.chargeStatus].variant}
            appearance="soft"
            dot
          >
            {CHARGE_STATUS[entry.chargeStatus].label}
          </Badge>
        ) : null}
      </div>
    </TableCell>
    <TableCell
      className={`text-right align-top tabular-nums ${AMOUNT_CLASS[entry.kind]}`}
    >
      {entry.amountLabel}
    </TableCell>
    <TableCell className="text-right align-top tabular-nums text-muted-foreground">
      {entry.balanceLabel}
    </TableCell>
    <TableCell className="text-right align-top">
      {canManageBilling && entry.kind === 'payment' ? (
        <LedgerRowActions
          entryId={entry.id}
          onVoid={onVoidPayment}
          onRefund={onRefundPayment}
        />
      ) : null}
    </TableCell>
  </TableRow>
);

export const LedgerCard = ({
  ledger,
  balance,
  canManageBilling,
  onVoidPayment,
  onRefundPayment,
}: {
  readonly ledger: readonly OrgLedgerEntry[];
  readonly balance?: OrgBalance | undefined;
  readonly canManageBilling: boolean;
  readonly onVoidPayment: (entryId: string, reason: string) => void;
  readonly onRefundPayment: (entryId: string, reason: string) => void;
}) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Ledger</CardTitle>
        {balance ? (
          <span
            className={`text-sm font-medium ${BALANCE_TONE[balance.state]}`}
          >
            {BALANCE_LABEL[balance.state](balance.label)}
          </span>
        ) : null}
      </div>
    </CardHeader>
    <CardContent>
      {ledger.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No billing activity yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Movement</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((entry) => (
              <LedgerRow
                key={entry.id}
                entry={entry}
                canManageBilling={canManageBilling}
                onVoidPayment={onVoidPayment}
                onRefundPayment={onRefundPayment}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);
