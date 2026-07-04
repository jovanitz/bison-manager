/**
 * Billing lever dialogs for the Org Detail view (ADR-0016) — a view part.
 * WHICH dialog is open is VM data (`BillingDialogVM`), never owned here; only
 * the controlled form inputs are local. Mark paid / extend trial are ABSOLUTE
 * setters ("paid through DATE", "trial ends DATE") with a MANDATORY reason.
 */
import { useState, type ReactNode } from 'react';
import { Badge } from '../../../design-system/badge/badge';
import { Button } from '../../../design-system/button/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../design-system/dialog/dialog';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import { Textarea } from '../../../design-system/textarea/textarea';
import {
  RadioGroup,
  RadioGroupItem,
} from '../../../design-system/radio-group/radio-group';
import type { BillingDialogVM, PlanOption } from './org-detail.types';

const ReasonField = ({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor="billing-reason">Reason</Label>
    <Textarea
      id="billing-reason"
      value={value}
      placeholder="Audited — why this change?"
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const Shell = ({
  title,
  onClose,
  children,
  footer,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}) => (
  <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">{children}</div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {footer}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const PlanRow = ({ option }: { readonly option: PlanOption }) => (
  <label
    className={`flex items-center gap-3 rounded-md border border-border p-3 ${
      option.current ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'
    }`}
  >
    <RadioGroupItem value={option.planId} disabled={option.current} />
    <span className="flex flex-1 flex-wrap items-center gap-2 text-sm font-medium text-foreground">
      {option.label}
      {option.hidden ? (
        <Badge variant="secondary" appearance="soft">
          Hidden
        </Badge>
      ) : null}
      {option.current ? (
        <Badge variant="outline" appearance="soft">
          Current
        </Badge>
      ) : null}
    </span>
    <span className="text-xs text-muted-foreground">
      {option.priceLabel ?? 'No price yet'}
    </span>
  </label>
);

const ChangePlanDialog = ({
  options,
  onClose,
  onSubmit,
}: {
  readonly options: readonly PlanOption[];
  readonly onClose: () => void;
  readonly onSubmit: (planId: string, reason: string) => void;
}) => {
  const [planId, setPlanId] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Shell
      title="Change plan"
      onClose={onClose}
      footer={
        <Button
          disabled={planId === '' || reason.trim() === ''}
          onClick={() => onSubmit(planId, reason)}
        >
          Change plan
        </Button>
      }
    >
      <RadioGroup value={planId} onValueChange={setPlanId}>
        {options.map((option) => (
          <PlanRow key={option.planId} option={option} />
        ))}
      </RadioGroup>
      <ReasonField value={reason} onChange={setReason} />
    </Shell>
  );
};

const DateLeverDialog = ({
  title,
  dateLabel,
  onClose,
  onSubmit,
}: {
  readonly title: string;
  readonly dateLabel: string;
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
        <p className="text-xs text-muted-foreground">
          Absolute date — idempotent under retries
        </p>
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
      <DateLeverDialog
        title="Mark paid"
        dateLabel="Paid through"
        onClose={onCloseBillingDialog}
        onSubmit={onSubmitMarkPaid}
      />
    );
  return (
    <DateLeverDialog
      title="Extend trial"
      dateLabel="Trial ends on"
      onClose={onCloseBillingDialog}
      onSubmit={onSubmitExtendTrial}
    />
  );
};
