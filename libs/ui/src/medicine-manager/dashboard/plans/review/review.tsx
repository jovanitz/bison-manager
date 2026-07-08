/**
 * The plan-edit "Review changes" gate (ADR-0016). Plan edits propagate live to
 * every subscriber, so before committing the staff sees exactly WHAT changed
 * (before→after), WHO it reaches (over-limit / lose-feature counts), the
 * grandfather warning when a price is raised, and must give an audited reason.
 * Pure: a function of `pending` (BlastRadiusVM) + the confirm/cancel actions.
 */
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
import type {
  BlastRadiusVM,
  PlanChangeLine,
  PlansActions,
} from '../plans.types';

const ChangeRow = ({ line }: { readonly line: PlanChangeLine }) => (
  <div className="flex items-baseline justify-between gap-3 text-sm">
    <span className="text-muted-foreground">{line.label}</span>
    <span className="flex items-baseline gap-1.5 text-right">
      <span className="text-muted-foreground line-through">{line.before}</span>
      <ArrowRight className="size-3 shrink-0 self-center text-muted-foreground" />
      <span className="font-medium text-foreground">{line.after}</span>
    </span>
  </div>
);

const ImpactLine = ({
  n,
  children,
}: {
  readonly n: number;
  readonly children: string;
}) => (
  <div className="flex items-baseline gap-2 text-sm">
    <span className="font-semibold tabular-nums text-warning-soft-foreground">
      {n}
    </span>
    <span className="text-muted-foreground">{children}</span>
  </div>
);

/** The read-only summary: what changed, who it reaches, the grandfather note.
 *  With no changes, nothing propagates — so only the empty notice shows. */
const ChangesSummary = ({ pending }: { readonly pending: BlastRadiusVM }) => {
  const showImpact =
    pending.wouldGoOverLimit > 0 || pending.wouldLoseFeature > 0;
  if (pending.changes.length === 0) {
    return (
      <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
        No changes to apply — nothing will be written.
      </p>
    );
  }
  return (
    <>
      <Stack gap="tight" className="rounded-md border border-border p-3">
        {pending.changes.map((line) => (
          <ChangeRow key={line.label} line={line} />
        ))}
      </Stack>
      {pending.priceRaised ? (
        <Alert variant="warning">
          <AlertTitle>This raises the price for everyone</AlertTitle>
          <AlertDescription>
            All {pending.subscribers} current subscribers move to the new price.
            To keep them on the old price, use the legacy-plan playbook instead:
            hide this plan and publish a new one.
          </AlertDescription>
        </Alert>
      ) : null}
      {showImpact ? (
        <Stack gap="tight" className="rounded-md border border-border p-3">
          <ImpactLine n={pending.wouldGoOverLimit}>
            orgs will be over the new limit — kept, but can’t grow until under
            it
          </ImpactLine>
          <ImpactLine n={pending.wouldLoseFeature}>
            orgs will lose a feature they currently use
          </ImpactLine>
        </Stack>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Trials and existing grace windows are frozen — changes here affect new
        subscriptions only.
      </p>
    </>
  );
};

export const ReviewChangesDialog = ({
  pending,
  onConfirmEdit,
  onCancelEdit,
}: { readonly pending: BlastRadiusVM } & Pick<
  PlansActions,
  'onConfirmEdit' | 'onCancelEdit'
>) => {
  const [reason, setReason] = useState('');
  const blocked = pending.changes.length === 0 || reason.trim() === '';
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancelEdit())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review changes to “{pending.planName}”</DialogTitle>
          <DialogDescription>
            Plan edits apply live to all {pending.subscribers} subscribers.
          </DialogDescription>
        </DialogHeader>
        <Stack gap="field">
          {pending.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t apply the changes</AlertTitle>
              <AlertDescription>{pending.error}</AlertDescription>
            </Alert>
          ) : null}
          <ChangesSummary pending={pending} />
          <Stack gap="tight">
            <Label htmlFor="edit-reason">Reason (required)</Label>
            <Textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audited with the before/after payloads — why this change?"
            />
          </Stack>
        </Stack>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelEdit}>
            Cancel
          </Button>
          <Button
            disabled={blocked}
            loading={pending.confirming}
            onClick={() => onConfirmEdit(reason.trim())}
          >
            Confirm change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
