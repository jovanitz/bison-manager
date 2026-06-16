// Design system
export * from './design-system/cn';
export * from './design-system/button';
export * from './design-system/input';
export * from './design-system/card';

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
export * from './dashboard/admin-access';
export * from './dashboard/login-screen';
export * from './dashboard/require-admin';
export * from './dashboard/dashboard-screen';
export * from './dashboard/invitations/invite-member-form';
export * from './dashboard/invitations/activate-invitation-screen';
export * from './dashboard/permissions/manage-permissions-form';
export * from './dashboard/block/block-buttons';

// Client app: customer-facing self-serve (signup, home, org switcher)
export * from './client/client-login-screen';
export * from './client/client-home-screen';
export * from './client/require-session';
export * from './client/manage-org/manage-org-section';
