/**
 * Shared chrome for the billing lever dialogs (ADR-0016) — the modal Shell and
 * the mandatory Reason field. Kept in its own file so change-plan /
 * record-payment / date-lever dialogs reuse it without an import cycle through
 * the dispatcher (org-detail.billing-dialogs).
 */
import type { ReactNode } from 'react';
import { Button } from '../../../../design-system/button/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system/dialog/dialog';
import { Label } from '../../../../design-system/label/label';
import { Textarea } from '../../../../design-system/textarea/textarea';

export const ReasonField = ({
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

export const Shell = ({
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
