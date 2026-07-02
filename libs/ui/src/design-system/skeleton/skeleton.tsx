import type { HTMLAttributes } from 'react';
import { cn } from '../cn';

/** Loading placeholder — a pulsing token-colored block. Shape it with className
 *  (height, width, radius) to mirror the content it stands in for. */
export const Skeleton = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('animate-pulse rounded-md bg-muted', className)}
    {...props}
  />
);
