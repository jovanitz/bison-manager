import {
  useEffect,
  useState,
  type Dispatch,
  type MouseEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Menu } from 'lucide-react';
import { cn } from '../cn';
import { glassSheen } from '../glass';
import { Sidebar } from '../sidebar/sidebar';
import { SidebarProvider } from '../sidebar/sidebar-context';
import { Topbar } from '../topbar/topbar';
import { BottomNav, BottomNavItem } from '../bottom-nav/bottom-nav';
import { CommandDialog } from '../command/command';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '../drawer/drawer';

export type AppShellProps = {
  /** Sidebar *contents* (header/switcher/nav/footer …). Rendered as a persistent
   *  column at lg+, and as the full bottom-sheet nav below lg. */
  readonly sidebar: ReactNode;
  /** Topbar *contents* (TopbarTitle/Actions …). Omit for a chromeless screen. */
  readonly topbar?: ReactNode;
  /** 3-4 top destinations (BottomNavItem) for the mobile/tablet bottom bar; the
   *  shell appends a "More" entry that opens the full nav. Omit to hide the bar. */
  readonly bottomNav?: ReactNode;
  /** ⌘K command-palette *contents* (CommandInput + CommandList + groups). When
   *  present, the shell mounts the palette and binds ⌘K/Ctrl+K + `/` globally. */
  readonly commandPalette?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
};

const isTypingTarget = (el: EventTarget | null): boolean => {
  const t = el as HTMLElement | null;
  return (
    !!t &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  );
};

/** Global palette shortcuts: ⌘K / Ctrl+K toggles; `/` opens (unless typing). */
const useCommandK = (setOpen: Dispatch<SetStateAction<boolean>>) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(() => true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);
};

/** Mounts the ⌘K command palette and wires its global shortcuts. */
const CommandLayer = ({ children }: { readonly children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  useCommandK(setOpen);
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {children}
    </CommandDialog>
  );
};

/**
 * Reveal the bottom bar only once the "More" sheet has finished sliding shut, so
 * it doesn't peek through the closing animation. The timeout is a safety fallback
 * (paired with the drawer's onAnimationEnd) so the bar never sticks hidden.
 */
const useBarReveal = (moreOpen: boolean) => {
  const [barHidden, setBarHidden] = useState(false);
  useEffect(() => {
    if (moreOpen) {
      setBarHidden(true);
      return;
    }
    const t = setTimeout(() => setBarHidden(false), 600);
    return () => clearTimeout(t);
  }, [moreOpen]);
  return [barHidden, setBarHidden] as const;
};

type MoreDrawerProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAnimationEnd: (open: boolean) => void;
  readonly onClick: (e: MouseEvent) => void;
  readonly children: ReactNode;
};

/** The full nav as a draggable bottom sheet (mobile/tablet), opened by "More". */
const MoreDrawer = ({
  open,
  onOpenChange,
  onAnimationEnd,
  onClick,
  children,
}: MoreDrawerProps) => (
  <Drawer
    open={open}
    onOpenChange={onOpenChange}
    onAnimationEnd={onAnimationEnd}
  >
    <DrawerContent className="lg:hidden" onClick={onClick}>
      <div className={cn(glassSheen, 'rounded-t-xl')} />
      <DrawerTitle className="sr-only">Navigation</DrawerTitle>
      <DrawerDescription className="sr-only">
        Primary navigation
      </DrawerDescription>
      <div className="flex min-h-0 flex-col overflow-y-auto pb-6">
        {children}
      </div>
    </DrawerContent>
  </Drawer>
);

/**
 * Responsive app frame. Desktop (lg+): persistent, collapsible sidebar. Mobile &
 * tablet (<lg): a thumb-reachable bottom bar of top destinations plus a "More"
 * button that opens the full nav as a draggable bottom sheet (drag the handle
 * down to dismiss). Pure layout — owns only ephemeral sheet/bar UI state.
 */
export const AppShell = ({
  sidebar,
  topbar,
  bottomNav,
  commandPalette,
  children,
  className,
  contentClassName,
}: AppShellProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const closeOnNav = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest('a, button');
    // Close on a real navigation tap, but NOT when toggling an accordion parent
    // (a collapsible trigger carries aria-expanded) — that should expand in place.
    if (!el || el.hasAttribute('aria-expanded')) return;
    setMoreOpen(false);
  };

  const [barHidden, setBarHidden] = useBarReveal(moreOpen);

  return (
    <div
      className={cn('flex h-screen overflow-hidden bg-background', className)}
    >
      <div className="hidden lg:flex">
        <SidebarProvider>
          <Sidebar>{sidebar}</Sidebar>
        </SidebarProvider>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {topbar ? <Topbar>{topbar}</Topbar> : null}
        <main
          className={cn('flex-1 overflow-y-auto p-4 md:p-6', contentClassName)}
        >
          {children}
        </main>
        {bottomNav ? (
          <BottomNav
            className={cn(
              'transition-opacity duration-200 lg:hidden',
              barHidden && 'pointer-events-none opacity-0',
            )}
          >
            {bottomNav}
            <BottomNavItem
              icon={<Menu />}
              onClick={() => setMoreOpen(true)}
              aria-label="More"
            >
              More
            </BottomNavItem>
          </BottomNav>
        ) : null}
      </div>

      <MoreDrawer
        open={moreOpen}
        onOpenChange={setMoreOpen}
        onAnimationEnd={(open) => {
          if (!open) setBarHidden(false);
        }}
        onClick={closeOnNav}
      >
        {sidebar}
      </MoreDrawer>

      {commandPalette ? <CommandLayer>{commandPalette}</CommandLayer> : null}
    </div>
  );
};
