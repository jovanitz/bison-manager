import type { Meta, StoryObj } from '@storybook/react';
import {
  AlertTriangle,
  CreditCard,
  Settings,
  User,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { Topbar, TopbarActions, TopbarSeparator } from './topbar';
import { TopbarSearch } from './topbar-search';
import { TopbarStat } from './topbar-stat';
import { OrgSwitcher, type Org } from '../org-switcher/org-switcher';
import { UserMenu } from '../user-menu/user-menu';
import { NotificationsMenu } from '../notifications/notifications-menu';
import { NotificationItem } from '../notifications/notification-item';
import { DropdownMenuItem } from '../dropdown-menu/dropdown-menu';

const meta: Meta<typeof Topbar> = {
  title: 'Design System/Topbar',
  component: Topbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Topbar>;

const orgs: readonly Org[] = [
  { id: 'acme', name: 'Acme Inc.', fallback: 'AC', caption: 'Owner' },
  { id: 'globex', name: 'Globex Corp.', fallback: 'GX', caption: 'Admin' },
];

const accountItems = (
  <>
    <DropdownMenuItem>
      <User />
      Profile
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Settings />
      Account settings
    </DropdownMenuItem>
    <DropdownMenuItem>
      <CreditCard />
      Billing
    </DropdownMenuItem>
  </>
);

/**
 * Full multi-org bar (the chosen pattern): OrgSwitcher on the left, a search
 * field, then contextual stat + notifications + the personal UserMenu on the
 * right. The org context and the identity are deliberately separate controls.
 */
export const MultiOrg: Story = {
  render: () => (
    <Topbar>
      <OrgSwitcher current={orgs[0]} orgs={orgs} onCreate={() => undefined} />
      <TopbarSeparator className="hidden sm:block" />
      <TopbarSearch
        placeholder="Search…"
        shortcut="/"
        wrapperClassName="hidden flex-1 sm:block sm:max-w-sm"
      />
      <TopbarActions>
        <TopbarStat
          icon={<Wallet />}
          label="Balance"
          className="hidden md:inline-flex"
        >
          $0.00
        </TopbarStat>
        <NotificationsMenu
          count={2}
          unreadCount={2}
          onMarkAllRead={() => undefined}
          onViewAll={() => undefined}
        >
          <NotificationItem
            unread
            icon={<UserPlus />}
            title="Ana invited you to Acme"
            time="2m"
          />
          <NotificationItem
            unread
            icon={<AlertTriangle />}
            title="Build #421 failed"
            time="1h"
          />
        </NotificationsMenu>
        <UserMenu
          name="Josh Torres"
          email="josh@acme.com"
          onSignOut={() => undefined}
        >
          {accountItems}
        </UserMenu>
      </TopbarActions>
    </Topbar>
  ),
};
