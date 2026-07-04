/**
 * Plan create/edit form + retire confirm dialogs (ADR-0016). Open/close and
 * mode are VM data; only the controlled inputs are view-local state, seeded
 * from `form.draft` (the body is keyed by planId so a new target reseeds).
 *
 * UX contract (create and edit are the SAME form):
 * - The stable key is never typed: auto-slugged from the name on create,
 *   read-only context on edit (with the live subscriber count — you should
 *   know 37 orgs sit on a plan before touching it).
 * - Sections read in support order: Plan → Staff → Commercial → Entitlements.
 * - Edit submits "Review changes" — it chains into the blast-radius gate.
 */
import { useState } from 'react';
import { Button } from '../../../design-system/button/button';
import { Input } from '../../../design-system/input/input';
import { Textarea } from '../../../design-system/textarea/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../design-system/dialog/dialog';
import {
  AvailabilityField,
  Field,
  FormSection,
  LimitField,
  PriceFields,
} from './plans.form.fields';
import { FeaturePicker } from './plans.form.features';
import {
  draftInvalid,
  slugify,
  text,
  num,
  type Patch,
  type PlanDraft,
  type PlanFormProps,
  type RetireConfirmProps,
} from './plans.types';

/** Name + edit context. The key is derived silently on create (visible in
 *  the catalog table); edit shows it with the plan's reach — you should know
 *  which "Pro" you're touching and how many orgs sit on it. */
const PlanIdentity = (p: {
  readonly draft: PlanDraft;
  readonly editing: boolean;
  readonly subscribers: number | undefined;
  readonly rename: (v: string) => void;
}) => (
  <FormSection title="Plan">
    <Field label="Display name">
      <Input placeholder="Pro" {...text(p.draft.displayName, p.rename)} />
      {p.editing ? (
        <p className="text-xs text-muted-foreground">
          Key: {p.draft.key} · {p.subscribers ?? 0} subscribers on this plan
        </p>
      ) : null}
    </Field>
  </FormSection>
);

const FormBody = ({ form, onSubmitForm, onCancelForm }: PlanFormProps) => {
  const [d, setD] = useState(form.draft);
  const up: Patch = (p) => setD((x) => ({ ...x, ...p }));
  const editing = form.mode === 'edit';
  const rename = (v: string) =>
    up(editing ? { displayName: v } : { displayName: v, key: slugify(v) });
  return (
    <>
      <div className="-ml-1 grid min-h-0 flex-1 content-start gap-6 overflow-y-auto pb-1 pl-1 pr-3">
        <PlanIdentity
          draft={d}
          editing={editing}
          subscribers={form.subscribers}
          rename={rename}
        />
        <FormSection title="Staff">
          <Field label="Internal note (required, staff only)">
            <Textarea
              placeholder="Why this plan exists, for whom — future you reads this during a dispute."
              {...text(d.internalNote, (v) => up({ internalNote: v }))}
            />
          </Field>
          <AvailabilityField
            visibility={d.visibility}
            set={(visibility) => up({ visibility })}
          />
        </FormSection>
        <FormSection title="Commercial">
          <PriceFields price={d.price} patch={up} />
          <Field label="Free trial (months)">
            <Input {...num(d.trialMonths, (v) => up({ trialMonths: v }))} />
            <p className="text-xs text-muted-foreground">
              0 = no trial. New subscriptions only — existing orgs keep their
              dates.
            </p>
          </Field>
        </FormSection>
        <FormSection title="Entitlements">
          <div className="grid gap-4 sm:grid-cols-2">
            <LimitField
              label="Max orgs owned"
              value={d.maxOrganizationsOwned}
              set={(v) => up({ maxOrganizationsOwned: v })}
            />
            <LimitField
              label="Max members per org"
              value={d.maxMembersPerOrg}
              set={(v) => up({ maxMembersPerOrg: v })}
            />
          </div>
          <FeaturePicker
            selected={d.features}
            set={(features) => up({ features })}
          />
        </FormSection>
      </div>
      <DialogFooter className="border-t border-border pt-4">
        <Button variant="outline" onClick={onCancelForm}>
          Cancel
        </Button>
        <Button disabled={draftInvalid(d)} onClick={() => onSubmitForm(d)}>
          {editing ? 'Review changes' : 'Create plan'}
        </Button>
      </DialogFooter>
    </>
  );
};

/** "Create plan" / "Edit plan" — the dialog around the draft-seeded body. */
export const PlanFormDialog = (props: PlanFormProps) => (
  <Dialog open onOpenChange={(o) => (o ? undefined : props.onCancelForm())}>
    <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {props.form.mode === 'create'
            ? 'Create plan'
            : `Edit “${props.form.draft.displayName}”`}
        </DialogTitle>
      </DialogHeader>
      <FormBody key={props.form.planId ?? 'create'} {...props} />
    </DialogContent>
  </Dialog>
);

/** Retire = closed to new subscriptions — subscribers keep operating. */
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
      <DialogFooter>
        <Button variant="outline" onClick={onCancelRetire}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirmRetire}>
          Retire plan
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
