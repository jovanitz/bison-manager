import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export const Card = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'rounded-lg border border-slate-200 bg-white shadow-sm',
      className,
    )}
    {...props}
  />
);

export const CardBody = ({ children }: { children: ReactNode }) => (
  <div className="p-4">{children}</div>
);
