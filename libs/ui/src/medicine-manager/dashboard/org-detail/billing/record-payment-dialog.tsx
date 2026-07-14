/**
 * Record-payment / reactivate dialog (ADR-0016). The resulting coverage is
 * COMPUTED by policy and shown read-only — staff confirm a payment was
 * received, they never type the paid-through date (that would break the
 * anchored cycle / the credit for suspension downtime). A free-date correction
 * lives in a separate "Adjust coverage" override, not here.
 */
import { useState, type ReactNode } from 'react';
import { Button } from '../../../../design-system/button/button';
import type { RecordPaymentPreview } from '../org-detail.types';
import { ReasonField, Shell } from './dialog-shell';

const Line = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{children}</span>
  </div>
);

export const RecordPaymentDialog = ({
  preview,
  onClose,
  onSubmit,
}: {
  readonly preview: RecordPaymentPreview;
  readonly onClose: () => void;
  readonly onSubmit: (paidThrough: string, reason: string) => void;
}) => {
  const [reason, setReason] = useState('');
  return (
    <Shell
      title="Record payment"
      onClose={onClose}
      footer={
        <Button
          disabled={reason.trim() === ''}
          onClick={() => onSubmit(preview.newPaidThrough, reason)}
        >
          Confirm payment
        </Button>
      }
    >
      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <Line label="Period">{preview.periodLabel}</Line>
        <Line label="Amount">{preview.amountLabel}</Line>
        <Line label="Paid through">{preview.newPaidThrough}</Line>
      </div>
      <p className="text-xs text-muted-foreground">
        {preview.creditNote ??
          'Renewal stays on the anchor date — computed, not entered.'}
      </p>
      <ReasonField value={reason} onChange={setReason} />
    </Shell>
  );
};
