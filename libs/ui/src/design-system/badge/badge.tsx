import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

/**
 * Badge (shadcn/ui). Token-based. Two appearances:
 * - `solid` (default): a filled chip — brand/status fills.
 * - `soft`: a low-noise status pill — faint tint + tone-colored label + an
 *   optional leading `dot`. Ideal for row/table status (active/invited/blocked).
 * Both read design tokens only; the soft label uses `--*-soft-foreground` so it
 * stays legible on the tint in light and dark.
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 border transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        outline: 'text-foreground',
      },
      appearance: {
        solid: 'rounded-md px-2.5 py-0.5 text-xs font-semibold',
        soft: 'rounded-full px-2 py-0.5 text-[0.6875rem] font-medium capitalize',
      },
    },
    compoundVariants: [
      {
        appearance: 'soft',
        variant: 'success',
        class: 'border-success/20 bg-success/10 text-success-soft-foreground',
      },
      {
        appearance: 'soft',
        variant: 'warning',
        class: 'border-warning/25 bg-warning/10 text-warning-soft-foreground',
      },
      {
        appearance: 'soft',
        variant: 'destructive',
        class:
          'border-destructive/20 bg-destructive/10 text-destructive-soft-foreground',
      },
      {
        appearance: 'soft',
        variant: 'secondary',
        class: 'border-border bg-muted text-muted-foreground',
      },
    ],
    defaultVariants: { variant: 'default', appearance: 'solid' },
  },
);

/** Hue for the leading `dot` — the full-saturation token per variant. */
const dotColor: Record<string, string> = {
  default: 'bg-primary',
  secondary: 'bg-muted-foreground',
  destructive: 'bg-destructive',
  success: 'bg-success',
  warning: 'bg-warning',
  outline: 'bg-foreground',
};

export type BadgeProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants> & {
    /** Show a leading hue dot (for soft status pills). */
    readonly dot?: boolean;
  };

export const Badge = ({
  className,
  variant,
  appearance,
  dot = false,
  children,
  ...props
}: BadgeProps) => (
  <div
    className={cn(badgeVariants({ variant, appearance }), className)}
    {...props}
  >
    {dot ? (
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          dotColor[variant ?? 'default'],
        )}
      />
    ) : null}
    {children}
  </div>
);
