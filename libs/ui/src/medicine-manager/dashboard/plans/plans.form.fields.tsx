/**
 * Field primitives for the plan form (plans.form.tsx) — split out to keep
 * each file inside the hard size caps. Import-free helpers live in
 * plans.types.ts; the feature picker in plans.form.features.tsx.
 */
import type { ReactNode } from 'react';
import { Checkbox } from '../../../design-system/checkbox/checkbox';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import { Stack } from '../../../design-system/stack/stack';
import {
  RadioGroup,
  RadioGroupItem,
} from '../../../design-system/radio-group/radio-group';
import {
  asInterval,
  noPrice,
  num,
  type Patch,
  type PlanDraft,
  type PlanVisibility,
} from './plans.types';

/** Input-token classes for the two tiny native selects (currency/interval). */
const sel = 'h-9 rounded-md border border-input bg-transparent px-3 text-sm';

/** A titled form section — the form reads in scannable blocks. */
export const FormSection = (p: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <Stack gap="field">
    <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {p.title}
    </p>
    {p.children}
  </Stack>
);

export const Field = (p: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <Stack gap="tight">
    <Label>{p.label}</Label>
    {p.children}
  </Stack>
);

export const CheckRow = (p: {
  readonly checked: boolean;
  readonly set: (on: boolean) => void;
  readonly children: ReactNode;
}) => (
  <label className="flex items-center gap-2 text-sm">
    <Checkbox checked={p.checked} onCheckedChange={(c) => p.set(c === true)} />
    {p.children}
  </label>
);

/** A radio option with its consequence written under the label. */
const RadioRow = (p: {
  readonly value: string;
  readonly label: string;
  readonly caption: string;
}) => (
  <label className="flex items-start gap-2 text-sm">
    <RadioGroupItem value={p.value} className="mt-0.5" />
    <span>
      {p.label}
      {p.caption ? (
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {p.caption}
        </span>
      ) : null}
    </span>
  </label>
);

/** Public vs hidden is a choice with consequences — spelled out in place. */
export const AvailabilityField = (p: {
  readonly visibility: PlanVisibility;
  readonly set: (v: PlanVisibility) => void;
}) => (
  <Field label="Availability">
    <RadioGroup
      className="gap-3"
      value={p.visibility}
      onValueChange={(v) => p.set(v === 'hidden' ? 'hidden' : 'public')}
    >
      <RadioRow
        value="public"
        label="Public"
        caption="Offered to new signups."
      />
      <RadioRow
        value="hidden"
        label="Hidden"
        caption="Staff-assign only — for legacy terms and custom deals. Customers still see the display name, so a legacy plan can read simply “Pro”."
      />
    </RadioGroup>
  </Field>
);

/** Unlimited hides the number entirely — no disabled input showing a fake 0. */
export const LimitField = (p: {
  readonly label: string;
  readonly value: number | null;
  readonly set: (v: number | null) => void;
}) => (
  <Field label={p.label}>
    <CheckRow checked={p.value === null} set={(u) => p.set(u ? null : 1)}>
      Unlimited
    </CheckRow>
    {p.value !== null ? <Input {...num(p.value, p.set)} /> : null}
  </Field>
);

/**
 * Pricing is an explicit two-way choice, so the staff never reasons about
 * "null vs 0": either the price is not decided yet (the plan can't be charged
 * and its orgs are never blocked for non-payment), or the plan is priced —
 * and the amount starts EMPTY, not 0.
 */
export const PriceFields = (p: {
  readonly price: PlanDraft['price'];
  readonly patch: Patch;
}) => {
  const up = (part: Partial<NonNullable<PlanDraft['price']>>) =>
    p.price ? p.patch({ price: { ...p.price, ...part } }) : undefined;
  return (
    <Field label="Pricing">
      <RadioGroup
        className="gap-3"
        value={p.price ? 'priced' : 'none'}
        onValueChange={(v) => p.patch({ price: noPrice(v === 'none') })}
      >
        <RadioRow
          value="none"
          label="No price yet"
          caption="Can't be charged — subscribers are never blocked for non-payment."
        />
        <RadioRow value="priced" label="Priced" caption="" />
      </RadioGroup>
      {p.price ? (
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            min={1}
            placeholder="499"
            value={p.price.amountCents > 0 ? p.price.amountCents / 100 : ''}
            onChange={(e) =>
              up({
                amountCents:
                  Math.max(0, Math.trunc(Number(e.target.value) || 0)) * 100,
              })
            }
          />
          <select
            className={sel}
            value={p.price.currency}
            onChange={(e) => up({ currency: e.target.value })}
          >
            <option>MXN</option>
            <option>USD</option>
          </select>
          <select
            className={sel}
            value={p.price.interval}
            onChange={(e) => up({ interval: asInterval(e.target.value) })}
          >
            <option>month</option>
            <option>year</option>
          </select>
        </div>
      ) : null}
      {p.price && p.price.amountCents <= 0 ? (
        <p className="text-xs text-muted-foreground">
          Enter the amount to save.
        </p>
      ) : null}
    </Field>
  );
};
