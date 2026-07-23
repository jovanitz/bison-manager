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
import { Button } from '../../../../design-system/button/button';
import { Input } from '../../../../design-system/input/input';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system/dialog/dialog';
import {
  AvailabilityField,
  Field,
  FormSection,
  LimitField,
  PriceFields,
} from './plans.form.fields';
import { FeaturePicker } from './plans.form.features';
import { draftInvalid, slugify, text, num } from './plans.form.helpers';
import type { Patch, PlanDraft, PlanFormProps } from '../plans.types';

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

/** The scrollable field body — Plan → Staff → Commercial → Entitlements. */
const FormFields = ({
  draft: d,
  up,
  editing,
  subscribers,
}: {
  readonly draft: PlanDraft;
  readonly up: Patch;
  readonly editing: boolean;
  readonly subscribers: number | undefined;
}) => {
  const rename = (v: string) =>
    up(editing ? { displayName: v } : { displayName: v, key: slugify(v) });
  return (
    <Stack
      gap="section"
      className="-ml-1 min-h-0 flex-1 overflow-y-auto pb-1 pl-1 pr-3"
    >
      <PlanIdentity
        draft={d}
        editing={editing}
        subscribers={subscribers}
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
    </Stack>
  );
};

/** Sticky footer: Cancel + submit ("Create plan" writes; "Review changes"
 *  chains to the blast-radius gate). The submit spins while creating. */
const FormFooter = ({
  editing,
  submitting,
  invalid,
  onSubmit,
  onCancel,
}: {
  readonly editing: boolean;
  readonly submitting: boolean | undefined;
  readonly invalid: boolean;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}) => (
  <DialogFooter className="border-t border-border pt-4">
    <Button variant="outline" onClick={onCancel}>
      Cancel
    </Button>
    <Button disabled={invalid} loading={submitting} onClick={onSubmit}>
      {editing ? 'Review changes' : 'Create plan'}
    </Button>
  </DialogFooter>
);

/** Create writes straight to the catalog (no second gate), so its audited
 *  reason is collected here; edit gathers the reason later at the blast gate. */
const CreateReason = (p: {
  readonly value: string;
  readonly set: (v: string) => void;
}) => (
  <Field label="Reason for the audit log (required)">
    <Textarea
      placeholder="Why add this plan to the catalog? Recorded on the plan.created event."
      {...text(p.value, p.set)}
    />
  </Field>
);

const FormBody = ({ form, onSubmitForm, onCancelForm }: PlanFormProps) => {
  const [d, setD] = useState(form.draft);
  const [reason, setReason] = useState('');
  const up: Patch = (p) => setD((x) => ({ ...x, ...p }));
  const editing = form.mode === 'edit';
  const missingReason = !editing && reason.trim() === '';
  return (
    <>
      {form.error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t create the plan</AlertTitle>
          <AlertDescription>{form.error}</AlertDescription>
        </Alert>
      ) : null}
      <FormFields
        draft={d}
        up={up}
        editing={editing}
        subscribers={form.subscribers}
      />
      {editing ? null : <CreateReason value={reason} set={setReason} />}
      <FormFooter
        editing={editing}
        submitting={form.submitting}
        invalid={draftInvalid(d) || missingReason}
        onSubmit={() => onSubmitForm(d, editing ? undefined : reason.trim())}
        onCancel={onCancelForm}
      />
    </>
  );
};

/** "Create plan" / "Edit plan" — the dialog around the draft-seeded body. */
export const PlanFormDialog = (props: PlanFormProps) => (
  <Dialog open onOpenChange={(o) => (o ? undefined : props.onCancelForm())}>
    <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
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
