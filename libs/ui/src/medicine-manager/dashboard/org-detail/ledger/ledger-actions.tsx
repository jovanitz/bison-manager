/**
 * Corrections on a payment ledger row (ADR-0018 Decision 6) — append-only:
 * `void` (a payment recorded by mistake, as if it never happened) or `refund`
 * (money actually returned), each with a mandatory reason. Only payment rows
 * get this; charges are settled by the account-level Record-payment lever.
 */
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import { Label } from '../../../../design-system/label/label';
import { Textarea } from '../../../../design-system/textarea/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../design-system/dropdown-menu/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system/dialog/dialog';

type Action = 'void' | 'refund';

const CorrectionDialog = ({
  action,
  onClose,
  onConfirm,
}: {
  readonly action: Action | null;
  readonly onClose: () => void;
  readonly onConfirm: (reason: string) => void;
}) => {
  const [reason, setReason] = useState('');
  const close = () => {
    setReason('');
    onClose();
  };
  return (
    <Dialog
      open={action !== null}
      onOpenChange={(o) => (o ? undefined : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === 'refund' ? 'Refund payment' : 'Void payment'}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {action === 'refund'
            ? 'Records money returned to the customer — the balance reopens.'
            : 'Reverses a payment recorded by mistake — as if it never happened.'}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ledger-reason">Reason</Label>
          <Textarea
            id="ledger-reason"
            value={reason}
            placeholder="Audited — why this correction?"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim() === ''}
            onClick={() => {
              onConfirm(reason);
              close();
            }}
          >
            {action === 'refund' ? 'Refund' : 'Void'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const LedgerRowActions = ({
  entryId,
  onVoid,
  onRefund,
}: {
  readonly entryId: string;
  readonly onVoid: (entryId: string, reason: string) => void;
  readonly onRefund: (entryId: string, reason: string) => void;
}) => {
  const [action, setAction] = useState<Action | null>(null);
  const confirm = (reason: string) =>
    (action === 'refund' ? onRefund : onVoid)(entryId, reason);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Payment actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAction('void')}>
            Void — recorded by mistake
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction('refund')}>
            Refund — money returned
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CorrectionDialog
        action={action}
        onClose={() => setAction(null)}
        onConfirm={confirm}
      />
    </>
  );
};
