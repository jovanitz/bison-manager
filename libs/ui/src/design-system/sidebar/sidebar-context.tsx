import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Sidebar collapse state. `collapsed` is the pinned state (toggled by the user);
 * `peeking` is the transient hover/focus expand of the icon rail. `railed` is the
 * effective "show icons only" = collapsed && !peeking — components key off it.
 * Ephemeral UI state, like a Dialog's open flag. `useSidebar` tolerates a missing
 * provider (returns an expanded, no-op default) so the Sidebar also works
 * standalone (e.g. the AppShell mobile drawer).
 */
type SidebarState = {
  readonly collapsed: boolean;
  readonly peeking: boolean;
  readonly railed: boolean;
  readonly toggle: () => void;
  readonly setCollapsed: (value: boolean) => void;
  readonly setPeeking: (value: boolean) => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

const noop = (): void => undefined;

const EXPANDED: SidebarState = {
  collapsed: false,
  peeking: false,
  railed: false,
  toggle: noop,
  setCollapsed: noop,
  setPeeking: noop,
};

export const useSidebar = (): SidebarState =>
  useContext(SidebarContext) ?? EXPANDED;

export const SidebarProvider = ({
  children,
  defaultCollapsed = false,
}: {
  readonly children: ReactNode;
  readonly defaultCollapsed?: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [peeking, setPeeking] = useState(false);
  const value = useMemo<SidebarState>(
    () => ({
      collapsed,
      peeking,
      railed: collapsed && !peeking,
      toggle: () => {
        setCollapsed((c) => !c);
        setPeeking(false);
      },
      setCollapsed,
      setPeeking,
    }),
    [collapsed, peeking],
  );
  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
};
