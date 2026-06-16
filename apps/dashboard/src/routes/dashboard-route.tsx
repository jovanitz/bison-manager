import { DashboardScreen, RequireAdmin } from '@acme/ui';

/**
 * The protected dashboard route, in its own module so the router can `lazy`-load
 * it as a separate chunk. `RequireAdmin` shows the login form until an
 * authorized platform admin is present, then renders the directory tables.
 *
 * Default export: react-router's `lazy`/`React.lazy` resolve the module default.
 */
const DashboardRoute = () => (
  <RequireAdmin>
    <DashboardScreen />
  </RequireAdmin>
);

export default DashboardRoute;
