import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Design-system Button (Shadcn/UI-style: Tailwind classes, variant prop, plain
 * function component — no class, no forwardRef ceremony needed for the demo).
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const variants: Record<Variant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  destructive: 'bg-red-600 text-white hover:bg-red-500',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: Variant;
};

export const Button = ({ variant = 'primary', className, ...props }: ButtonProps) => (
  <button
    className={cn(
      'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
      variants[variant],
      className,
    )}
    {...props}
  />
);
