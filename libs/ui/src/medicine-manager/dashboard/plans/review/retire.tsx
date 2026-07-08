/**
 * Retire confirm dialog (ADR-0016): retiring closes a plan to ALL new
 * subscriptions — even staff — while its current subscribers keep operating.
 * Never a delete. The action button spins while the request is in flight and
 * surfaces a failure inline so the staff can retry. Pure view.
 */
import { Button } from '../../../../design-system/button/button';
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
}: RetireConfirmProps) => (
  <Dialog open onOpenChange={(o) => (o ? undefined : onCancelRetire())}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Retire “{pendingRetire.displayName}”?</DialogTitle>
        <DialogDescription>
          Closed to new subscriptions — {pendingRetire.subscribers} subscribers
          keep operating on it. Retired plans cannot be assigned, even by staff.
        </DialogDescription>
      </DialogHeader>
      {pendingRetire.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t retire the plan</AlertTitle>
          <AlertDescription>{pendingRetire.error}</AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onCancelRetire}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          loading={pendingRetire.retiring}
          onClick={onConfirmRetire}
        >
          Retire plan
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
