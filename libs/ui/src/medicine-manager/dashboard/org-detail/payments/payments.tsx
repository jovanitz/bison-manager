/**
 * Payments ledger for the Org Detail view — a manual reconciliation list (no
 * Stripe): each row is one charge with its status; staff with `canManageBilling`
 * can mark a pending/failed entry as paid. Distinct from the subscription-level
 * "Mark paid" lever, which sets the whole paid-through date.
 */
import { Badge, type BadgeProps } from '../../../../design-system/badge/badge';
import { Button } from '../../../../design-system/button/button';
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
import type { OrgPaymentRow, PaymentStatus } from '../org-detail.types';

const statusVariant: Record<PaymentStatus, BadgeProps['variant']> = {
  paid: 'success',
  pending: 'warning',
  failed: 'destructive',
  refunded: 'secondary',
};

/** Contextual right-cell: settled entries read as text; open ones get the lever. */
const RowAction = ({
  payment,
  canManageBilling,
  onMarkPaymentPaid,
}: {
  readonly payment: OrgPaymentRow;
  readonly canManageBilling: boolean;
  readonly onMarkPaymentPaid: (paymentId: string) => void;
}) => {
  if (payment.status === 'paid')
    return (
      <span className="text-xs text-muted-foreground">
        Paid {payment.paidAt}
      </span>
    );
  if (payment.status === 'refunded')
    return <span className="text-xs text-muted-foreground">Refunded</span>;
  if (!canManageBilling) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onMarkPaymentPaid(payment.paymentId)}
    >
      Mark as paid
    </Button>
  );
};

export const PaymentsCard = ({
  payments,
  canManageBilling,
  onMarkPaymentPaid,
}: {
  readonly payments: readonly OrgPaymentRow[];
  readonly canManageBilling: boolean;
  readonly onMarkPaymentPaid: (paymentId: string) => void;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Payments</CardTitle>
    </CardHeader>
    <CardContent>
      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.paymentId}>
                <TableCell className="font-medium">{p.period}</TableCell>
                <TableCell className="tabular-nums">{p.amountLabel}</TableCell>
                <TableCell>
                  <Badge
                    variant={statusVariant[p.status]}
                    appearance="soft"
                    dot
                  >
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <RowAction
                    payment={p}
                    canManageBilling={canManageBilling}
                    onMarkPaymentPaid={onMarkPaymentPaid}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);
