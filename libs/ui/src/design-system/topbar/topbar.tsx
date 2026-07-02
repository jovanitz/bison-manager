import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

export type TopbarProps = HTMLAttributes<HTMLElement> & {
  /** Leading slot, rendered before the title — used by AppShell for the mobile
   *  menu button. */
  readonly leading?: ReactNode;
};

/**
 * App-shell Topbar (shadcn-style composite). Pure presentation: a header bar
 * with an optional leading slot, a title and right-aligned actions. No
 * orchestration — the screen passes the content. Colors come from tokens.
 */
export const Topbar = ({
  className,
  leading,
  children,
  ...props
}: TopbarProps) => (
  <header
    className={cn(
      'flex h-14 items-center gap-3 border-b border-border bg-background px-4',
      className,
    )}
    {...props}
  >
    {leading}
    {children}
  </header>
);

export const TopbarTitle = ({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h1
    className={cn('truncate text-sm font-semibold text-foreground', className)}
    {...props}
  />
);

export const TopbarActions = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('ml-auto flex items-center gap-2', className)}
    {...props}
  />
);

export const TopbarSeparator = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('h-6 w-px bg-border', className)}
    role="separator"
    aria-orientation="vertical"
    {...props}
  />
);
