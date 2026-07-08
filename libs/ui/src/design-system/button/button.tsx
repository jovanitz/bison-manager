import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

/**
 * Design-system Button (shadcn/ui). Variants + sizes via `cva`; `asChild` renders
 * the styles onto a child element (e.g. an `<a>`) through Radix `Slot`. Colors
 * come from the design tokens (bg-primary, …), never raw palette values.
 *
 * Forwards its ref to the underlying element — required when a Radix trigger
 * (DropdownMenu, Tooltip, …) wraps it with `asChild`: without the ref the
 * trigger can't anchor its popover, so the menu never opens.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    readonly asChild?: boolean;
    /** Show a spinner and block clicks while a backend action is in flight. */
    readonly loading?: boolean | undefined;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* asChild renders through Slot (single child only) — no spinner there. */}
        {!asChild && loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
