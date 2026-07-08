import type { ComponentProps, ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '../cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip/tooltip';
import { useSidebar } from './sidebar-context';

const navItemVariants = cva(
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      active: {
        true: 'bg-accent text-accent-foreground',
        false: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      },
    },
    defaultVariants: { active: false },
  },
);

export type SidebarNavItemProps = ComponentProps<'button'> &
  VariantProps<typeof navItemVariants> & {
    readonly icon?: ReactNode;
    readonly badge?: ReactNode;
  };

/** Nav row: icon + label + optional badge. In the railed rail it shows only
 *  the icon, with the label as a hover tooltip. */
export const SidebarNavItem = ({
  className,
  active,
  icon,
  badge,
  children,
  ...props
}: SidebarNavItemProps) => {
  const { railed } = useSidebar();
  const button = (
    <button
      data-active={active ? 'true' : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        navItemVariants({ active }),
        railed && 'justify-center px-0',
        className,
      )}
      {...props}
    >
      {icon}
      {!railed && <span className="flex-1 truncate text-left">{children}</span>}
      {!railed && badge ? <span className="ml-auto">{badge}</span> : null}
    </button>
  );
  if (!railed) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{children}</TooltipContent>
    </Tooltip>
  );
};

export type SidebarCollapsibleProps = {
  readonly icon?: ReactNode;
  readonly label: ReactNode;
  readonly active?: boolean;
  readonly defaultOpen?: boolean;
  /** Nested sub-items (SidebarNavItem). */
  readonly children: ReactNode;
};

/** Expandable parent (e.g. Issues → Monitors / Notifiers). In the railed
 *  rail it degrades to a single icon item (no inline expansion). */
export const SidebarCollapsible = ({
  icon,
  label,
  active,
  defaultOpen = false,
  children,
}: SidebarCollapsibleProps) => {
  const { railed } = useSidebar();
  if (railed) {
    return (
      <SidebarNavItem icon={icon} active={active}>
        {label}
      </SidebarNavItem>
    );
  }
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Collapsible.Trigger asChild>
        <button className={cn(navItemVariants({ active }), 'group')}>
          {icon}
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="ml-[1.05rem] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export type SidebarMenuButtonProps = ComponentProps<'button'> & {
  readonly avatar?: ReactNode;
  readonly label: ReactNode;
  readonly sublabel?: ReactNode;
};

/** Account / org switcher row: avatar + label (+ sublabel) + chevron. Collapses
 *  to just the avatar in the rail. */
export const SidebarMenuButton = ({
  className,
  avatar,
  label,
  sublabel,
  ...props
}: SidebarMenuButtonProps) => {
  const { railed } = useSidebar();
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2 rounded-md p-1.5 text-sm transition-colors hover:bg-accent/50',
        railed && 'justify-center',
        className,
      )}
      {...props}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
        {avatar}
      </span>
      {!railed && (
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate font-medium text-foreground">{label}</span>
          {sublabel ? (
            <span className="truncate text-xs text-muted-foreground">
              {sublabel}
            </span>
          ) : null}
        </span>
      )}
      {!railed && (
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
};
