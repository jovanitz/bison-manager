import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type NotificationItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Leading icon or avatar. */
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Relative timestamp, e.g. "2m", "1h". */
  readonly time?: ReactNode;
  /** Unread → subtle tint + primary dot. */
  readonly unread?: boolean;
};

/** One notification row. Presentational — the screen decides what a tap does. */
export const NotificationItem = ({
  className,
  icon,
  title,
  description,
  time,
  unread,
  ...props
}: NotificationItemProps) => (
  <button
    type="button"
    data-unread={unread ? 'true' : undefined}
    className={cn(
      'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent',
      unread && 'bg-accent/40',
      className,
    )}
    {...props}
  >
    {icon ? (
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-4">
        {icon}
      </span>
    ) : null}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate font-medium text-foreground">{title}</span>
      {description ? (
        <span className="line-clamp-2 text-muted-foreground">
          {description}
        </span>
      ) : null}
      {time ? (
        <span className="text-xs text-muted-foreground/80">{time}</span>
      ) : null}
    </span>
    {unread ? (
      <span
        aria-label="Unread"
        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
      />
    ) : null}
  </button>
);
