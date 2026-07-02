import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '../cn';

export type TopbarNotificationsProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Unread count; shows a badge when > 0 (display caps at 9+). */
    readonly count?: number | undefined;
  };

/** Topbar notifications bell with an unread badge. */
export const TopbarNotifications = forwardRef<
  HTMLButtonElement,
  TopbarNotificationsProps
>(({ className, count = 0, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
    className={cn(
      'relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
    {...props}
  >
    <Bell className="size-[18px]" />
    {count > 0 ? (
      <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
        {count > 9 ? '9+' : count}
      </span>
    ) : null}
  </button>
));
TopbarNotifications.displayName = 'TopbarNotifications';
