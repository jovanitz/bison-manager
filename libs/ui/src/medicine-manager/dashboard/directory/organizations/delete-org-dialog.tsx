/**
 * Staged, reversible deletion for a dormant organization (ADR-0018 gap 9).
 * Deleting never purges on the spot: the org enters a 30-day *pending* window
 * (reversible); only after it do members, content and personal data get removed
 * — while the billing ledger is archived and retained for fiscal law. Staff can
 * export first, and must type the org name to arm the destructive confirm.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../design-system/alert-dialog/alert-dialog';
import { Button } from '../../../../design-system/button/button';
import { Input } from '../../../../design-system/input/input';
import { Label } from '../../../../design-system/label/label';

/** Export affordance + type-to-confirm gate (kept out of the shell for size). */
const DeleteBody = ({
  orgName,
  typed,
  setTyped,
  onExport,
}: {
  readonly orgName: string;
  readonly typed: string;
  readonly setTyped: (v: string) => void;
  readonly onExport: () => void;
}) => (
  <div className="flex flex-col gap-3">
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={onExport}
    >
      <Download /> Export data first
    </Button>
    <div className="grid gap-1.5">
      <Label htmlFor="confirm-name">
        Type <span className="font-medium text-foreground">{orgName}</span> to
        confirm
      </Label>
      <Input
        id="confirm-name"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={orgName}
        autoComplete="off"
      />
    </div>
  </div>
);

export const DeleteOrgDialog = ({
  open,
  orgName,
  onOpenChange,
  onExport,
  onConfirm,
}: {
  readonly open: boolean;
  readonly orgName: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onExport: () => void;
  readonly onConfirm: () => void;
}) => {
  const [typed, setTyped] = useState('');
  const close = () => {
    setTyped('');
    onOpenChange(false);
  };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {orgName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This schedules deletion in <strong>30 days</strong> — reversible
            until then. After that, members, content and personal data are
            permanently removed. The billing ledger is archived and kept for
            fiscal law.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <DeleteBody
          orgName={orgName}
          typed={typed}
          setTyped={setTyped}
          onExport={onExport}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={typed.trim() !== orgName}
            onClick={() => {
              onConfirm();
              setTyped('');
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Schedule deletion
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
