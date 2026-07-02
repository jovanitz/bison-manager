import {
  ArrowLeftRight,
  LayoutDashboard,
  Moon,
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarNav,
  SidebarTrigger,
} from '../sidebar/sidebar';
import { SidebarNavItem } from '../sidebar/sidebar-nav';
import { useSidebar } from '../sidebar/sidebar-context';
import { TopbarActions } from '../topbar/topbar';
import { TopbarSearch } from '../topbar/topbar-search';
import { OrgSwitcher, type Org } from '../org-switcher/org-switcher';
import { UserMenu } from '../user-menu/user-menu';
import { NotificationsMenu } from '../notifications/notifications-menu';
import { NotificationItem } from '../notifications/notification-item';
import { DropdownMenuItem } from '../dropdown-menu/dropdown-menu';
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../command/command';
import { BottomNavItem } from '../bottom-nav/bottom-nav';
import { Card, CardContent, CardHeader, CardTitle } from '../card/card';

/** Demo fixtures for the AppShell story (kept out of the story to stay small). */
const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'directory', label: 'Directory', icon: Users },
  { key: 'access', label: 'Access', icon: ShieldCheck },
] as const;

const ORGS: readonly Org[] = [
  { id: 'acme', name: 'Acme Inc.', fallback: 'AC', caption: 'Owner' },
  { id: 'globex', name: 'Globex Corp.', fallback: 'GX', caption: 'Admin' },
];

type SelectProps = {
  readonly active: string;
  readonly onSelect: (k: string) => void;
};

export const BottomItems = ({ active, onSelect }: SelectProps) => (
  <>
    {NAV.map(({ key, label, icon: Icon }) => (
      <BottomNavItem
        key={key}
        icon={<Icon />}
        active={active === key}
        onClick={() => onSelect(key)}
      >
        {label}
      </BottomNavItem>
    ))}
  </>
);

export const Nav = ({ active, onSelect }: SelectProps) => {
  const { railed } = useSidebar();
  return (
    <>
      <SidebarHeader>
        {!railed && (
          <>
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <span className="flex-1 truncate">Staff Console</span>
          </>
        )}
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroupLabel>Manage</SidebarGroupLabel>
        <SidebarNav>
          {NAV.map(({ key, label, icon: Icon }) => (
            <SidebarNavItem
              key={key}
              icon={<Icon />}
              active={active === key}
              onClick={() => onSelect(key)}
            >
              {label}
            </SidebarNavItem>
          ))}
        </SidebarNav>
      </SidebarContent>
      <SidebarFooter>
        <SidebarNavItem icon={<Settings />}>Settings</SidebarNavItem>
      </SidebarFooter>
    </>
  );
};

export const Head = () => (
  <>
    <OrgSwitcher current={ORGS[0]} orgs={ORGS} onCreate={() => undefined} />
    <TopbarSearch
      placeholder="Search…"
      shortcut="/"
      wrapperClassName="ml-1 hidden flex-1 sm:block sm:max-w-xs"
    />
    <TopbarActions>
      <NotificationsMenu
        count={1}
        unreadCount={1}
        onMarkAllRead={() => undefined}
        onViewAll={() => undefined}
      >
        <NotificationItem
          unread
          icon={<UserPlus />}
          title="Ana invited you to Acme"
          time="2m"
        />
      </NotificationsMenu>
      <UserMenu
        name="Josh Torres"
        email="josh@acme.com"
        onSignOut={() => undefined}
      >
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Account settings
        </DropdownMenuItem>
      </UserMenu>
    </TopbarActions>
  </>
);

/** ⌘K palette contents — passed to AppShell, which mounts it + binds ⌘K and `/`. */
export const CmdPalette = () => (
  <>
    <CommandInput placeholder="Type a command or search…" />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Go to">
        <CommandItem>
          <LayoutDashboard />
          Directory
        </CommandItem>
        <CommandItem>
          <ShieldCheck />
          Access
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Actions">
        <CommandItem>
          <ArrowLeftRight />
          Switch to Globex Corp.
        </CommandItem>
        <CommandItem>
          <UserPlus />
          Invite member
          <CommandShortcut>⌘I</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <Moon />
          Toggle theme
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </>
);

export const Content = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {['Staff', 'Customers', 'Orphans'].map((t) => (
      <Card key={t}>
        <CardHeader>
          <CardTitle>{t}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Section content…
        </CardContent>
      </Card>
    ))}
  </div>
);
