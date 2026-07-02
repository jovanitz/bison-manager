import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

/**
 * Inline alert / callout (shadcn-style). Soft treatment: tinted bg + colored
 * border + colored leading icon, with neutral title/description for readability.
 * Status variants read the design tokens (success/warning/destructive; info uses
 * primary), so they follow light/dark + brand. Add a lucide icon as the first
 * child to get the leading slot.
 */
const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4 [&>svg+div]:translate-y-[-3px] [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground [&>svg]:text-foreground',
        info: 'border-primary/30 bg-primary/10 text-foreground [&>svg]:text-primary',
        success:
          'border-success/30 bg-success/10 text-foreground [&>svg]:text-success',
        warning:
          'border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning',
        destructive:
          'border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export const Alert = ({ className, variant, ...props }: AlertProps) => (
  <div
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
);

export const AlertTitle = ({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h5
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
);

export const AlertDescription = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <div
    className={cn(
      'text-sm text-muted-foreground [&_p]:leading-relaxed',
      className,
    )}
    {...props}
  />
);
