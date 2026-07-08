import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/**
 * The vertical rhythm scale. Four NAMED steps map to Tailwind spacing units, so
 * screens express spacing *intent* ("these are sibling fields") instead of a raw
 * pixel number that drifts (`gap-3` here, `gap-4` there, for the same meaning).
 *
 * Add a step here — in this one place — never with an off-scale `gap-N` at a
 * call site. Horizontal inline groups keep `flex … gap-2` (that IS the scale's
 * inline step); Stack owns the *vertical* stacking rhythm.
 */
const GAP = {
  /** 6px — a label and the single control it names. */
  tight: 'gap-1.5',
  /** 12px — compact stacks: two related blocks that shouldn't touch. */
  cozy: 'gap-3',
  /** 16px — sibling fields inside one section. */
  field: 'gap-4',
  /** 24px — page-level blocks: header, then the table/cards below it. */
  group: 'gap-6',
  /** 32px — major sections inside one dense surface (e.g. a form's parts). */
  section: 'gap-8',
} as const;

export type StackGap = keyof typeof GAP;

export type StackProps = HTMLAttributes<HTMLDivElement> & {
  readonly gap: StackGap;
};

/** Vertical layout with a named rhythm step instead of a raw gap number.
 *  `grid-cols-1` (minmax(0,1fr)) caps the single column at the container width,
 *  so a wide child (a table) scrolls inside itself instead of pushing the page. */
export const Stack = ({ gap, className, ...props }: StackProps) => (
  <div
    className={cn('grid grid-cols-1 content-start', GAP[gap], className)}
    {...props}
  />
);
