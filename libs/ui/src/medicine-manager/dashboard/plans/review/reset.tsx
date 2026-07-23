/**
 * Reset-to-defaults confirm dialog (ADR-0016). A reset restores the plan to its
 * code floor — a mass live-edit in disguise, so it carries the same audited
 * reason as an edit. There is no preview endpoint for a reset, so this WARNS
 * (subscribers move to the code-floor entitlements) rather than counting an
 * exact blast radius. Pure: a function of `pendingReset` + confirm/cancel.
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
import type { ResetConfirmProps } from '../plans.types';

export const ResetConfirmDialog = ({
  pendingReset,
  onConfirmReset,
  onCancelReset,
}: ResetConfirmProps) => {
  const [reason, setReason] = useState('');
  const blocked = reason.trim() === '';
  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onCancelReset())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Reset “{pendingReset.displayName}” to defaults?
          </DialogTitle>
          <DialogDescription>
            Restores this plan to its code floor — a mass live-edit. Its{' '}
            {pendingReset.subscribers} subscribers move to the code-floor
            entitlements. Plans with no code seed can’t be reset.
          </DialogDescription>
        </DialogHeader>
        <Stack gap="field">
          {pendingReset.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t reset the plan</AlertTitle>
              <AlertDescription>{pendingReset.error}</AlertDescription>
            </Alert>
          ) : null}
          <Stack gap="tight">
            <Label htmlFor="reset-reason">Reason (required)</Label>
            <Textarea
              id="reset-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audited with the before/after payloads — why reset now?"
            />
          </Stack>
        </Stack>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelReset}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={blocked}
            loading={pendingReset.resetting}
            onClick={() => onConfirmReset(reason.trim())}
          >
            Reset plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
