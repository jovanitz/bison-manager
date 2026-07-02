import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  readonly orientation?: 'horizontal' | 'vertical';
  /** Decorative (aria-hidden) vs a semantic separator. */
  readonly decorative?: boolean;
};

/** Divider line (token-based). Horizontal by default; pass `orientation` for a
 *  vertical rule (give it a height via a flex/grid parent). */
export const Separator = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: SeparatorProps) => (
  <div
    role={decorative ? 'none' : 'separator'}
    aria-orientation={decorative ? undefined : orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
);
