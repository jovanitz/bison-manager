/**
 * Feature picker for the plan form — a collapsible section list. Each
 * namespace group is an accordion row headed by its selected/total counter;
 * clicking it reveals the features inside, and each feature toggles with a
 * checkmark. Searching filters the vocabulary and auto-expands the matching
 * sections. Scales to dozens of features without a wall of checkboxes.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../design-system/accordion/accordion';
import { Badge } from '../../../design-system/badge/badge';
import { Input } from '../../../design-system/input/input';
import { cn } from '../../../design-system/cn';
import { Field } from './plans.form.fields';
import {
  KNOWN_FEATURES,
  featureGroups,
  text,
  toggle,
  type FeatureGroup,
} from './plans.types';

const FeatureRow = (p: {
  readonly f: string;
  readonly on: boolean;
  readonly flip: () => void;
}) => (
  <button
    type="button"
    onClick={p.flip}
    aria-pressed={p.on}
    className={cn(
      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent',
      p.on && 'bg-accent/50',
    )}
  >
    <Check
      className={cn(
        'size-3.5 shrink-0 text-success-soft-foreground',
        !p.on && 'invisible',
      )}
    />
    <span className="font-mono text-xs">{p.f}</span>
  </button>
);

const GroupCounter = (p: { readonly sel: number; readonly total: number }) => (
  <Badge
    variant={p.sel > 0 ? 'success' : 'secondary'}
    appearance="soft"
    dot={p.sel > 0}
  >
    {p.sel}/{p.total}
  </Badge>
);

export const FeaturePicker = (p: {
  readonly selected: readonly string[];
  readonly set: (features: readonly string[]) => void;
}) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<readonly string[]>([]);
  const groups = featureGroups(KNOWN_FEATURES, q);
  const searching = q.trim() !== '';
  const selIn = (g: FeatureGroup) =>
    g.keys.filter((k) => p.selected.includes(k)).length;
  return (
    <Field label={`Features (${p.selected.length} included)`}>
      <Input placeholder="Search features…" {...text(q, setQ)} />
      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No features match.</p>
      ) : (
        <Accordion
          type="multiple"
          value={searching ? groups.map((g) => g.name) : [...open]}
          onValueChange={(v) => (searching ? undefined : setOpen(v))}
          className="rounded-md border border-border px-2"
        >
          {groups.map((g) => (
            <AccordionItem
              key={g.name}
              value={g.name}
              className="last:border-b-0"
            >
              <AccordionTrigger className="py-2 text-sm hover:no-underline">
                <span className="flex flex-1 items-center justify-between gap-2 pr-2">
                  {g.name}
                  <GroupCounter sel={selIn(g)} total={g.keys.length} />
                </span>
              </AccordionTrigger>
              <AccordionContent className="grid gap-0.5 pb-2">
                {g.keys.map((f) => (
                  <FeatureRow
                    key={f}
                    f={f}
                    on={p.selected.includes(f)}
                    flip={() =>
                      p.set(toggle(p.selected, f, !p.selected.includes(f)))
                    }
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Field>
  );
};
