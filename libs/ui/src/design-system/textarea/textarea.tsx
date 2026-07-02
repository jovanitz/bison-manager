import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Design-system Textarea (shadcn/ui). Token-based; forwards ref for RHF. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
