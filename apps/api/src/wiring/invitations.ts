import {
  createInMemoryIdentityProvisioner,
  createUnconfiguredNotificationSender,
} from '@acme/infrastructure';
import {
  createNodeSecretTokenService,
  createSupabaseAdminProvisioner,
} from '@acme/infrastructure-node';
import {
  makeAccessInvitationsUseCases,
  type AccessInvitationsDeps,
  type AccessInvitationsUseCases,
  type InvitationLinks,
  type NotificationSender,
} from '@acme/application';
import type { ApiConfig } from './config';

/** Where the dashboard lives when the operator has not said otherwise. */
const DEFAULT_APP_BASE_URL = 'http://localhost:4203';

/**
 * Outbound email. With no provider configured the FAIL-CLOSED sender refuses
 * out loud, so a "Resend email" can never report a success it did not deliver.
 * `main.ts` injects the console sender in dev; a real provider adapter (SMTP /
 * Resend / SES) slots in here and nothing else moves.
 */
export const toNotificationSender = (config: ApiConfig): NotificationSender =>
  config.notifications ?? createUnconfiguredNotificationSender();

/**
 * The activation link the invitee opens. The API cannot infer its own app's
 * origin (it may sit behind any host), so the operator supplies it. The token
 * goes in the FRAGMENT: browsers never send it to a server, keeping it out of
 * access logs and Referer headers.
 */
export const toInvitationLinks = (config: ApiConfig): InvitationLinks => ({
  activationUrl: (token) =>
    `${config.appBaseUrl ?? DEFAULT_APP_BASE_URL}/activate#token=${encodeURIComponent(token)}`,
});


/**
 * Activation needs to mint identities: the real Supabase admin when configured,
 * else an in-memory provisioner (dev-stub / tests). The token service is
 * server-side everywhere (CSPRNG + one-way hash).
 */
const toProvisioner = (config: ApiConfig) =>
  config.supabaseUrl && config.supabaseSecretKey
    ? createSupabaseAdminProvisioner({
        supabaseUrl: config.supabaseUrl,
        secretKey: config.supabaseSecretKey,
      })
    : createInMemoryIdentityProvisioner();

/** The invitation context: issue, activate, list, rotate, revoke, resend. */
export const wireInvitations = (
  config: ApiConfig,
  deps: Omit<
    AccessInvitationsDeps,
    'tokens' | 'provisioner' | 'notifications' | 'links'
  >,
): AccessInvitationsUseCases =>
  makeAccessInvitationsUseCases({
    ...deps,
    tokens: createNodeSecretTokenService(),
    provisioner: toProvisioner(config),
    notifications: toNotificationSender(config),
    links: toInvitationLinks(config),
  });
