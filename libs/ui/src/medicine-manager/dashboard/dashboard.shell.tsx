import type { ReactNode } from 'react';
import {
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  ScrollText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppShell } from '../../design-system/app-shell/app-shell';
import {
  SidebarContent,
  SidebarHeader,
  SidebarNav,
  SidebarTrigger,
} from '../../design-system/sidebar/sidebar';
import { SidebarNavItem } from '../../design-system/sidebar/sidebar-nav';
import { useSidebar } from '../../design-system/sidebar/sidebar-context';
import { TopbarActions } from '../../design-system/topbar/topbar';
import {
  OrgSwitcher,
  type Org,
} from '../../design-system/org-switcher/org-switcher';
import { UserMenu } from '../../design-system/user-menu/user-menu';

/**
 * Shared dashboard page frame for the Medicine Manager stories — the design
 * system's AppShell (sidebar + topbar) so each section renders as it will look
 * in the real product. Story-only: the app composes shell + view via the route;
 * the `.view.tsx` files stay presentational (content-only).
 */
export type DashboardSection =
  | 'Directory'
  | 'Permissions'
  | 'Roles'
  | 'Templates'
  | 'Plans'
  | 'Invite'
  | 'Audit'
  | 'Settings';

const NAV: ReadonlyArray<{
  readonly label: DashboardSection;
  readonly icon: typeof Users;
}> = [
  { label: 'Directory', icon: Users },
  { label: 'Permissions', icon: KeyRound },
  { label: 'Roles', icon: ShieldCheck },
  { label: 'Templates', icon: LayoutTemplate },
  { label: 'Plans', icon: CreditCard },
  { label: 'Invite', icon: UserPlus },
  { label: 'Audit', icon: ScrollText },
  { label: 'Settings', icon: Settings },
];

const ORGS: readonly Org[] = [
  { id: 'acme', name: 'Acme Health', fallback: 'AH', owner: true },
  { id: 'globex', name: 'Globex Clinics', fallback: 'GC', caption: 'Admin' },
];

// Business rule (UI): you may own at most one org — offer "Create" only when you
// don't already own one.
const canCreateOrg = !ORGS.some((o) => o.owner);

const Nav = ({
  active,
  onNavigate,
}: {
  readonly active: DashboardSection;
  readonly onNavigate?: ((section: DashboardSection) => void) | undefined;
}) => {
  const { railed } = useSidebar();
  return (
    <>
      <SidebarHeader>
        {!railed && (
          <>
            <LayoutDashboard className="size-5 shrink-0 text-primary" />
            <span className="flex-1 truncate">Medicine Manager</span>
          </>
        )}
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav>
          {NAV.map(({ label, icon: Icon }) => (
            <SidebarNavItem
              key={label}
              icon={<Icon />}
              active={label === active}
              onClick={() => onNavigate?.(label)}
            >
              {label}
            </SidebarNavItem>
          ))}
        </SidebarNav>
      </SidebarContent>
    </>
  );
};

const Head = () => (
  <>
    <OrgSwitcher
      current={ORGS[0]}
      orgs={ORGS}
      onCreate={() => undefined}
      canCreate={canCreateOrg}
    />
    <TopbarActions>
      <UserMenu
        name="Josh Torres"
        email="josh@acme.com"
        onSignOut={() => undefined}
      />
    </TopbarActions>
  </>
);

export const DashboardShell = ({
  active,
  onNavigate,
  children,
}: {
  readonly active: DashboardSection;
  readonly onNavigate?: (section: DashboardSection) => void;
  readonly children: ReactNode;
}) => (
  <AppShell
    sidebar={<Nav active={active} onNavigate={onNavigate} />}
    topbar={<Head />}
  >
    {children}
  </AppShell>
);
