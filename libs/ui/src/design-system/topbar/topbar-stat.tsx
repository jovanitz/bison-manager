import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type TopbarStatProps = HTMLAttributes<HTMLDivElement> & {
  readonly icon?: ReactNode;
  /** Dim caption before the value (e.g. "Balance"). */
  readonly label?: ReactNode;
};

/**
 * Compact contextual stat pill — a generic slot for a domain metric. (OpenSea
 * surfaces a wallet balance here; fill it with whatever your app shows.)
 * Presentational only.
 */
export const TopbarStat = ({
  className,
  icon,
  label,
  children,
  ...props
}: TopbarStatProps) => (
  <div
    className={cn(
      'inline-flex h-9 items-center gap-2 rounded-md bg-muted/60 px-3 text-sm',
      className,
    )}
    {...props}
  >
    {icon ? (
      <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>
    ) : null}
    {label ? <span className="text-muted-foreground">{label}</span> : null}
    <span className="font-semibold tabular-nums text-foreground">
      {children}
    </span>
  </div>
);
