/**
 * Billing lever dialogs dispatcher for the Org Detail view (ADR-0016). WHICH
 * dialog is open is VM data (`BillingDialogVM`), never owned here; only the
 * controlled inputs are local. Record-payment shows a COMPUTED coverage (see
 * billing/record-payment-dialog); extend-trial is an absolute date setter.
 */
import { useState } from 'react';
import { Button } from '../../../design-system/button/button';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import type { BillingDialogVM } from './org-detail.types';
import { ReasonField, Shell } from './billing/dialog-shell';
import { ChangePlanDialog } from './billing/change-plan-dialog';
import { RecordPaymentDialog } from './billing/record-payment-dialog';

/** Absolute date setter — only extend-trial uses it (record-payment is computed). */
const DateLeverDialog = ({
  title,
  dateLabel,
  hint,
  onClose,
  onSubmit,
}: {
  readonly title: string;
  readonly dateLabel: string;
  readonly hint: string;
  readonly onClose: () => void;
  readonly onSubmit: (date: string, reason: string) => void;
}) => {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Shell
      title={title}
      onClose={onClose}
      footer={
        <Button
          disabled={date === '' || reason.trim() === ''}
          onClick={() => onSubmit(date, reason)}
        >
          {title}
        </Button>
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lever-date">{dateLabel}</Label>
        <Input
          id="lever-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <ReasonField value={reason} onChange={setReason} />
    </Shell>
  );
};

export const BillingDialogs = ({
  dialog,
  onCloseBillingDialog,
  onSubmitChangePlan,
  onSubmitMarkPaid,
  onSubmitExtendTrial,
}: {
  readonly dialog: BillingDialogVM;
  readonly onCloseBillingDialog: () => void;
  readonly onSubmitChangePlan: (planId: string, reason: string) => void;
  readonly onSubmitMarkPaid: (paidThrough: string, reason: string) => void;
  readonly onSubmitExtendTrial: (trialEndsAt: string, reason: string) => void;
}) => {
  if (dialog.kind === 'change-plan')
    return (
      <ChangePlanDialog
        options={dialog.options}
        onClose={onCloseBillingDialog}
        onSubmit={onSubmitChangePlan}
      />
    );
  if (dialog.kind === 'mark-paid')
    return (
      <RecordPaymentDialog
        preview={dialog.preview}
        onClose={onCloseBillingDialog}
        onSubmit={onSubmitMarkPaid}
      />
    );
  return (
    <DateLeverDialog
      title="Extend trial"
      dateLabel="Trial ends on"
      hint="The trial runs until this date."
      onClose={onCloseBillingDialog}
      onSubmit={onSubmitExtendTrial}
    />
  );
};
