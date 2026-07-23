/**
 * The generic confirm gate for the Roles + Templates destructive / propagating
 * actions (delete role, reset role, reset template, apply-to-all). `description`
 * is a ReactNode so a caller can spell out the blast radius. Spins while the
 * request is in flight and surfaces a failure inline so the staff can retry.
 * Pure: a function of the props the view passes.
 */
import type { ReactNode } from 'react';
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

export type ConfirmDialogProps = {
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly errorTitle: string;
  readonly destructive?: boolean;
  readonly loading?: boolean | undefined;
  readonly error?: string | undefined;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export const ConfirmDialog = ({
  title,
  description,
  confirmLabel,
  errorTitle,
  destructive,
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Dialog open onOpenChange={(o) => (o ? undefined : onCancel())}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
