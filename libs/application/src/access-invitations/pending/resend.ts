import {
  type Clock,
  type Result,
  type TaggedError,
  err,
  ok,
} from '@acme/shared';
import { ACCESS_INVITATION_TTL_DAYS } from '@acme/domain';
import type { AccessActor, InvitationId } from '@acme/domain';
import { authorizeAccessAction } from '../../access/authorize';
import type {
  NotificationError,
  NotificationSender,
} from '../../ports/notifications';
import { invitationNotFound } from '../errors';
import type { AccessInvitationUseCaseError } from '../errors';
import type { AccessInvitationStore, SecretTokenService } from '../ports';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds the URL the invitee opens. The composition root owns it because only
 * the app knows its own public origin; the token belongs in the FRAGMENT, which
 * browsers never send to a server (out of access logs and Referer headers).
 */
export type InvitationLinks = {
  readonly activationUrl: (token: string) => string;
};

export type ResendInvitationDeps = {
  readonly invitations: Pick<
    AccessInvitationStore,
    'findPendingById' | 'regenerateToken'
  >;
  readonly tokens: Pick<SecretTokenService, 'issue'>;
  readonly notifications: NotificationSender;
  readonly links: InvitationLinks;
  readonly clock: Clock;
};

export type ResendInvitationError =
  | AccessInvitationUseCaseError
  | NotificationError
  | TaggedError<'app/invitation-not-found'>;

/**
 * Re-send a pending invitation's link by email.
 *
 * Resending necessarily ROTATES the token: only its hash is stored, so the
 * original plaintext is unrecoverable — there is no way to re-send the *same*
 * link, and pretending otherwise would be a lie. The previous link therefore
 * stops working, which is also the safer default (a resend usually means the
 * first one went astray).
 *
 * Order matters and has a cost: we must mint before we can send, so a provider
 * failure leaves the OLD link already dead. We surface the send error instead of
 * swallowing it; retrying simply mints again. The alternative — send first — is
 * impossible, and keeping the old token alive on failure would mean two live
 * links for one invitation.
 */
export const makeResendInvitation =
  (deps: ResendInvitationDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly invitationId: string;
  }): Promise<Result<void, ResendInvitationError>> => {
    const now = deps.clock.now().toISOString();
    const invitationId = input.invitationId as InvitationId;

    const pending = await deps.invitations.findPendingById(invitationId, now);
    if (!pending) {
      return err(invitationNotFound('No pending invitation to resend.'));
    }

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'members.invite',
      resource: { accountId: pending.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const { token, tokenHash } = deps.tokens.issue();
    const expiresAt = new Date(
      deps.clock.now().getTime() + ACCESS_INVITATION_TTL_DAYS * DAY_MS,
    ).toISOString();
    const rotated = await deps.invitations.regenerateToken(
      invitationId,
      { tokenHash, expiresAt },
      now,
    );
    // Lost a race with an acceptance/revoke between the lookup and the rotate.
    if (!rotated) {
      return err(invitationNotFound('No pending invitation to resend.'));
    }

    const sent = await deps.notifications.send({
      to: pending.email,
      subject: 'Your invitation link',
      body:
        `You have been invited to join Acme.\n\n` +
        `Open this link to set your password and activate your account:\n` +
        `${deps.links.activationUrl(token)}\n\n` +
        `The link expires on ${expiresAt}. Any previous link no longer works.`,
    });
    if (!sent.ok) return err(sent.error);
    return ok(undefined);
  };
