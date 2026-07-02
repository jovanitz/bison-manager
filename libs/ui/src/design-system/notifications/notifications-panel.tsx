import type { ReactNode } from 'react';
import { BellOff } from 'lucide-react';
import { cn } from '../cn';

export type NotificationsPanelProps = {
  /** NotificationItem rows. */
  readonly children?: ReactNode;
  readonly unreadCount?: number;
  readonly onMarkAllRead?: (() => void) | undefined;
  readonly onViewAll?: (() => void) | undefined;
  /** Show the empty state instead of the list. */
  readonly empty?: boolean;
  readonly className?: string;
};

/**
 * Notifications panel body — header (+ "Mark all read"), a scrollable list (or
 * empty state), and a "View all" footer linking to the full page. Reused inside
 * both the desktop Popover and the mobile Drawer (see NotificationsMenu).
 */
export const NotificationsPanel = ({
  children,
  unreadCount = 0,
  onMarkAllRead,
  onViewAll,
  empty,
  className,
}: NotificationsPanelProps) => (
  <div className={cn('flex max-h-[28rem] w-full flex-col', className)}>
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="text-sm font-semibold text-foreground">
        Notifications
      </span>
      {onMarkAllRead && unreadCount > 0 ? (
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-medium text-primary hover:underline"
        >
          Mark all read
        </button>
      ) : null}
    </div>
    <div className="h-px bg-border" />
    {empty ? (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
        <BellOff className="size-6 opacity-60" />
        You&rsquo;re all caught up
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1">
        {children}
      </div>
    )}
    {onViewAll ? (
      <>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={onViewAll}
          className="px-3 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-accent"
        >
          View all
        </button>
      </>
    ) : null}
  </div>
);
