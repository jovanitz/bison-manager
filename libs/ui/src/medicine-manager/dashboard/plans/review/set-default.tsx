/**
 * The plans.setDefault confirm (ADR-0016). Making a plan the default only
 * changes what NEW organizations start on — existing subscriptions are
 * untouched, so there is no blast-radius preview here. But the change is audited
 * (billing.default-plan-changed), so a reason is required, like every plan write.
 * Pure: a function of `pendingSetDefault` + the confirm/cancel actions.
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
import type { SetDefaultConfirmProps } from '../plans.types';

export const SetDefaultConfirmDialog = ({
  pendingSetDefault,
  onConfirmSetDefault,
  onCancelSetDefault,
}: SetDefaultConfirmProps) => {
  const [reason, setReason] = useState('');
  const blocked = reason.trim() === '';
  const { displayName, currentDefaultName } = pendingSetDefault;
  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onCancelSetDefault())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make “{displayName}” the default plan?</DialogTitle>
          <DialogDescription>
            {currentDefaultName
              ? `New organizations will start on “${displayName}” instead of “${currentDefaultName}”.`
              : `New organizations will start on “${displayName}”.`}{' '}
            Existing subscriptions are unaffected.
          </DialogDescription>
        </DialogHeader>
        <Stack gap="field">
          {pendingSetDefault.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t set the default</AlertTitle>
              <AlertDescription>{pendingSetDefault.error}</AlertDescription>
            </Alert>
          ) : null}
          <Stack gap="tight">
            <Label htmlFor="set-default-reason">Reason (required)</Label>
            <Textarea
              id="set-default-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audited as the default-plan change — why now?"
            />
          </Stack>
        </Stack>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelSetDefault}>
            Cancel
          </Button>
          <Button
            disabled={blocked}
            loading={pendingSetDefault.setting}
            onClick={() => onConfirmSetDefault(reason.trim())}
          >
            Set as default
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
