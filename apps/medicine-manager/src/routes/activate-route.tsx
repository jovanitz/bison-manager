import { ActivateInvitationScreen } from '@acme/ui';

/**
 * The PUBLIC activation route — no `RequireAdmin`. The invitee arrives here from
 * the activation link (token in the URL fragment) to set their password. Its
 * own lazy chunk, like the dashboard route.
 */
const ActivateRoute = () => <ActivateInvitationScreen />;

export default ActivateRoute;
