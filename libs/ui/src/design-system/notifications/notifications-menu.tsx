import { Popover, PopoverContent, PopoverTrigger } from '../popover/popover';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '../drawer/drawer';
import { TopbarNotifications } from '../topbar/topbar-notifications';
import {
  NotificationsPanel,
  type NotificationsPanelProps,
} from './notifications-panel';

export type NotificationsMenuProps = NotificationsPanelProps & {
  /** Unread badge on the bell. */
  readonly count?: number | undefined;
};

/**
 * The standard responsive notifications control: a bell that opens a **popover**
 * panel on desktop (lg+) and a **bottom drawer** on mobile/tablet (a tiny
 * popover is cramped on a phone). Both render the same NotificationsPanel, with
 * a "View all" link to the full page for history. Drop-in for the topbar.
 */
export const NotificationsMenu = ({
  count,
  ...panel
}: NotificationsMenuProps) => (
  <>
    {/* Desktop: anchored popover */}
    <Popover>
      <PopoverTrigger asChild>
        <TopbarNotifications count={count} className="hidden lg:inline-flex" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationsPanel {...panel} />
      </PopoverContent>
    </Popover>

    {/* Mobile/tablet: bottom drawer */}
    <Drawer>
      <DrawerTrigger asChild>
        <TopbarNotifications count={count} className="lg:hidden" />
      </DrawerTrigger>
      <DrawerContent className="lg:hidden">
        <DrawerTitle className="sr-only">Notifications</DrawerTitle>
        <DrawerDescription className="sr-only">
          Recent notifications
        </DrawerDescription>
        <NotificationsPanel {...panel} className="max-h-[70vh] pb-2" />
      </DrawerContent>
    </Drawer>
  </>
);
