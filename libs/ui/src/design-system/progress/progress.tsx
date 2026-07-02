import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

export type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  /** Completion 0–100. */
  readonly value?: number;
};

/** Determinate progress bar (token-based). Composable width via className. */
export const Progress = ({ className, value = 0, ...props }: ProgressProps) => (
  <div
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    className={cn(
      'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
      className,
    )}
    {...props}
  >
    <div
      className="h-full w-full bg-primary transition-transform duration-300"
      style={{
        transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)`,
      }}
    />
  </div>
);
