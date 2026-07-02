import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Primary action(s), e.g. a Button. */
  readonly action?: ReactNode;
};

/**
 * Empty / zero-data placeholder (no members yet, no search results …). Dashed
 * frame + icon chip + title/description + optional action. Presentational.
 */
export const EmptyState = ({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
      className,
    )}
    {...props}
  >
    {icon ? (
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5">
        {icon}
      </div>
    ) : null}
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
    {action ? <div className="mt-1">{action}</div> : null}
  </div>
);
