import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

/**
 * Mobile/tablet bottom navigation bar (thumb-reachable). Holds 3-4 top
 * destinations plus a "More" trigger (added by the AppShell) that opens the full
 * nav as a bottom sheet. Hidden at lg+, where the persistent sidebar takes over.
 */
export const BottomNav = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <nav
    className={cn(
      'relative flex h-16 shrink-0 items-stretch border-t border-border bg-card',
      className,
    )}
    {...props}
  >
    {/* Primary glow along the top edge — same brand tint as the sidebar peek. */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-primary/15 to-transparent"
    />
    {children}
  </nav>
);

export type BottomNavItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly icon?: ReactNode;
  readonly active?: boolean;
};

export const BottomNavItem = ({
  className,
  icon,
  active,
  children,
  ...props
}: BottomNavItemProps) => (
  <button
    data-active={active ? 'true' : undefined}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium outline-none transition-colors focus-visible:bg-accent/50 [&>svg]:size-5',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      className,
    )}
    {...props}
  >
    {icon}
    <span className="max-w-full truncate">{children}</span>
  </button>
);
