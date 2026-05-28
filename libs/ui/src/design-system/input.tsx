import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Forwards its ref so libraries that need the underlying DOM node — notably
 * React Hook Form's uncontrolled `register()` — work when this component is
 * used in their place. Without `forwardRef`, the ref would be consumed by this
 * function component and RHF could never read the field's value.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
