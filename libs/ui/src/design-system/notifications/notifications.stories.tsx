import type { Meta, StoryObj } from '@storybook/react';
import { AlertTriangle, CreditCard, UserPlus } from 'lucide-react';
import { NotificationsMenu } from './notifications-menu';
import { NotificationsPanel } from './notifications-panel';
import { NotificationItem } from './notification-item';

const meta: Meta<typeof NotificationsMenu> = {
  title: 'Design System/Notifications',
  component: NotificationsMenu,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj<typeof NotificationsMenu>;

const rows = (
  <>
    <NotificationItem
      unread
      icon={<UserPlus />}
      title="Ana invited you to Acme"
      description="Accept to join as an admin."
      time="2m"
    />
    <NotificationItem
      unread
      icon={<AlertTriangle />}
      title="Build #421 failed"
      description="dashboard · main"
      time="1h"
    />
    <NotificationItem
      icon={<CreditCard />}
      title="Invoice paid"
      description="$48.00 · June"
      time="1d"
    />
  </>
);

/** The panel body on its own — the workbench view (also what Popover/Drawer
 *  render inside). */
export const Panel: Story = {
  render: () => (
    <div className="w-80 overflow-hidden rounded-md border bg-popover">
      <NotificationsPanel
        unreadCount={2}
        onMarkAllRead={() => undefined}
        onViewAll={() => undefined}
      >
        {rows}
      </NotificationsPanel>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-80 overflow-hidden rounded-md border bg-popover">
      <NotificationsPanel empty onViewAll={() => undefined} />
    </div>
  ),
};

/** The bell trigger. Click opens a popover (desktop) or a bottom drawer
 *  (resize below `lg`). */
export const Bell: Story = {
  render: () => (
    <NotificationsMenu
      count={2}
      unreadCount={2}
      onMarkAllRead={() => undefined}
      onViewAll={() => undefined}
    >
      {rows}
    </NotificationsMenu>
  ),
};
