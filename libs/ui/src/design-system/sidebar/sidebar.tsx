import {
  useRef,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
} from 'react';
import { Menu } from 'lucide-react';
import { cn } from '../cn';
import { glassPanel, glassSheen } from '../glass';
import { TooltipProvider } from '../tooltip/tooltip';
import { useSidebar } from './sidebar-context';

/**
 * App-shell Sidebar (VAPI-style): dark, dense, collapsible to an icon rail that
 * peek-expands on hover/focus (overlay — content doesn't reflow) and pins via the
 * trigger. Reads state from SidebarProvider (defaults to expanded, so it also
 * works standalone). Nav items + switcher in ./sidebar-nav; state in ./sidebar-context.
 */
export const Sidebar = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) => {
  const { collapsed, railed, peeking, setPeeking } = useSidebar();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const peek = (on: boolean) => {
    if (!collapsed) return; // only the pinned-collapsed rail peeks
    if (timer.current) clearTimeout(timer.current);
    if (on) setPeeking(true);
    else timer.current = setTimeout(() => setPeeking(false), 120);
  };
  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) peek(false);
  };
  // Peek on hover/focus over the rail — but NOT over the header (the 3-line
  // toggle): expanding there is click-only, so moving the cursor toward the
  // toggle doesn't pop the panel open. `onMouseOver` (vs enter) lets a move from
  // the header down into the nav still trigger the peek.
  const peekFromZone = (e: MouseEvent | FocusEvent) => {
    if ((e.target as HTMLElement).closest('[data-sidebar-no-peek]')) return;
    peek(true);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'relative h-full shrink-0 transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <aside
          data-collapsed={railed ? 'true' : undefined}
          // Hover/focus live on the aside (which grows to w-64 on peek), NOT the
          // 64px wrapper — otherwise moving into the expanded panel would leave
          // the wrapper's hover zone and collapse it instantly.
          onMouseOver={peekFromZone}
          onMouseLeave={() => peek(false)}
          onFocusCapture={peekFromZone}
          onBlurCapture={onBlur}
          className={cn(
            'absolute inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card text-card-foreground transition-[width] duration-200',
            railed ? 'w-16' : 'w-64',
            // Peek = frosted glass over content: blur + translucent tint +
            // saturate, an inner light ring + a top sheen. `bg-card/80` is the
            // readable fallback; the lower-opacity tint only kicks in where
            // backdrop-filter is supported.
            peeking && cn('shadow-xl', glassPanel),
            className,
          )}
          {...props}
        >
          {/* Brand glow at the top — always on (peek only adds the frosted glass). */}
          <div className={glassSheen} />
          {children}
        </aside>
      </div>
    </TooltipProvider>
  );
};

export const SidebarHeader = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => {
  const { railed } = useSidebar();
  return (
    <div
      // Hovering the header (the collapse toggle) must not peek the rail open —
      // it's a click-only zone. See Sidebar's peekFromZone.
      data-sidebar-no-peek=""
      className={cn(
        'flex h-14 items-center gap-2 border-b border-border px-3 font-semibold',
        railed && 'justify-center px-0',
        className,
      )}
      {...props}
    />
  );
};

/** Collapse toggle (panel icon). Desktop-only — the mobile drawer has its own
 *  close, and collapsing doesn't apply there. */
export const SidebarTrigger = ({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle sidebar"
      className={cn(
        'hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:inline-flex',
        className,
      )}
      {...props}
    >
      <Menu className="size-4" />
    </button>
  );
};

export const SidebarContent = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex-1 overflow-y-auto overflow-x-hidden px-2 py-2',
      className,
    )}
    {...props}
  />
);

export const SidebarFooter = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('mt-auto border-t border-border p-2', className)}
    {...props}
  />
);

export const SidebarGroupLabel = ({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => {
  const { railed } = useSidebar();
  if (railed) return null;
  return (
    <p
      className={cn(
        'px-2 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70',
        className,
      )}
      {...props}
    />
  );
};

export const SidebarNav = ({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <nav className={cn('flex flex-col gap-0.5', className)} {...props} />
);

export const SidebarSeparator = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('-mx-2 my-2 h-px bg-border', className)}
    role="separator"
    {...props}
  />
);
