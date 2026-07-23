/**
 * Retire confirm dialog (ADR-0016): retiring closes a plan to ALL new
 * subscriptions — even staff — while its current subscribers keep operating.
 * Never a delete. Audited like every plan lever, so a reason is required. The
 * action button spins while the request is in flight and surfaces a failure
 * inline so the staff can retry. Pure view.
 */
import { useState } from 'react';
import { Button } from '../../../../design-system/button/button';
import { Label } from '../../../../design-system/label/label';
import { Stack } from '../../../../design-system/stack/stack';
import { Textarea } from '../../../../design-system/textarea/textarea';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../../design-system/alert/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system/dialog/dialog';
import type { RetireConfirmProps } from '../plans.types';

export const RetireConfirmDialog = ({
  pendingRetire,
  onConfirmRetire,
  onCancelRetire,
}: RetireConfirmProps) => {
  const [reason, setReason] = useState('');
  const blocked = reason.trim() === '';
  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onCancelRetire())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retire “{pendingRetire.displayName}”?</DialogTitle>
          <DialogDescription>
            Closed to new subscriptions — {pendingRetire.subscribers}{' '}
            subscribers keep operating on it. Retired plans cannot be assigned,
            even by staff.
          </DialogDescription>
        </DialogHeader>
        <Stack gap="field">
          {pendingRetire.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t retire the plan</AlertTitle>
              <AlertDescription>{pendingRetire.error}</AlertDescription>
            </Alert>
          ) : null}
          <Stack gap="tight">
            <Label htmlFor="retire-reason">Reason (required)</Label>
            <Textarea
              id="retire-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audited on the plan.retired event — why retire it?"
            />
          </Stack>
        </Stack>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelRetire}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={blocked}
            loading={pendingRetire.retiring}
            onClick={() => onConfirmRetire(reason.trim())}
          >
            Retire plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
