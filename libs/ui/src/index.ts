// Design system
export * from './design-system/cn';
export * from './design-system/button/button';
export * from './design-system/input/input';
export * from './design-system/card/card';
export * from './design-system/badge/badge';
export * from './design-system/alert/alert';
export * from './design-system/alert-dialog/alert-dialog';
export * from './design-system/separator/separator';
export * from './design-system/skeleton/skeleton';
export * from './design-system/pagination/pagination';
export * from './design-system/form/form';
export * from './design-system/progress/progress';
export * from './design-system/breadcrumb/breadcrumb';
export * from './design-system/empty/empty-state';
export * from './design-system/accordion/accordion';
export * from './design-system/scroll-area/scroll-area';
export * from './design-system/label/label';
export * from './design-system/checkbox/checkbox';
export * from './design-system/switch/switch';
export * from './design-system/radio-group/radio-group';
export * from './design-system/textarea/textarea';
export * from './design-system/toggle/toggle';
export * from './design-system/toggle-group/toggle-group';
export * from './design-system/slider/slider';
export * from './design-system/hover-card/hover-card';
export * from './design-system/combobox/combobox';
export * from './design-system/context-menu/context-menu';
export * from './design-system/calendar/calendar';
export * from './design-system/date-picker/date-picker';
export * from './design-system/dialog/dialog';
export * from './design-system/command/command';
export * from './design-system/table/table';
export * from './design-system/data-table/data-table';
export * from './design-system/select/select';
export * from './design-system/dropdown-menu/dropdown-menu';
export * from './design-system/popover/popover';
export * from './design-system/avatar/avatar';
export * from './design-system/avatar/avatar-group';
export * from './design-system/tabs/tabs';
export * from './design-system/tooltip/tooltip';
export * from './design-system/sheet/sheet';
export * from './design-system/drawer/drawer';
export * from './design-system/sidebar/sidebar-context';
export * from './design-system/sidebar/sidebar';
export * from './design-system/sidebar/sidebar-nav';
export * from './design-system/topbar/topbar';
export * from './design-system/topbar/topbar-search';
export * from './design-system/topbar/topbar-stat';
export * from './design-system/topbar/topbar-notifications';
export * from './design-system/org-switcher/org-switcher';
export * from './design-system/user-menu/user-menu';
export * from './design-system/notifications/notification-item';
export * from './design-system/notifications/notifications-panel';
export * from './design-system/notifications/notifications-menu';
export * from './design-system/toast/toaster';
export * from './design-system/bottom-nav/bottom-nav';
export * from './design-system/app-shell/app-shell';

// Dependency-injection seam
export * from './di/use-cases-context';

// Runtime introspection bridge (dev-only; guard the call with import.meta.env.DEV)
export * from './debug/debug-bridge';

// Example feature
export * from './example/use-items';
export * from './example/item-form';
export * from './example/item-screen';

// Access: functional login/access skeleton (product screens replace it)
export * from './access/access-login-screen';

// Staff dashboard: login-only auth gate + staff/customer directory tables
export * from './dashboard/login-screen';
export * from './dashboard/require-admin';
export * from './dashboard/dashboard-screen';
// Medicine-manager giro: the app shell + the wired Directory container
// (ADR-0017 giro isolation, ADR-0018 billing coverage).
export * from './medicine-manager/dashboard/dashboard.shell';
export * from './medicine-manager/dashboard/directory/section/directory-section';
export * from './dashboard/invitations/invite-member-form';
export * from './dashboard/invitations/activate-invitation-screen';
export * from './dashboard/permissions/manage-permissions-form';
export * from './dashboard/block/block-buttons';

// Client app: customer-facing self-serve (signup, home, org switcher)
export * from './client/client-login-screen';
export * from './client/client-home-screen';
export * from './client/require-session';
export * from './client/manage-org/manage-org-section';
