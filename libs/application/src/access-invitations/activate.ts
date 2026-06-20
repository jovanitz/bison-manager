import { type Clock, type Result, err, ok } from '@acme/shared';
import {
  identityAlreadyExists,
  identityProvisionFailed,
  invitationTokenInvalid,
} from './errors';
import type { ActivateInvitationError } from './errors';
import type {
  AccessInvitationStore,
  IdentityProvisioner,
  SecretTokenService,
} from './ports';

export type ActivateInvitationDeps = {
  readonly invitations: Pick<AccessInvitationStore, 'findPendingByTokenHash'>;
  readonly provisioner: IdentityProvisioner;
  readonly tokens: Pick<SecretTokenService, 'hashOf'>;
  readonly clock: Clock;
};

/**
 * Activation (pre-login, no actor): the secret token is the only credential.
 * Hash it, find the live invitation, then create the identity with the chosen
 * password. Fail-closed and generic on a bad/expired/used token (no
 * enumeration); refuse if the email already has an identity (no takeover). The
 * membership itself is attached by the existing onboarding on first login.
 */
export const makeActivateInvitation =
  (deps: ActivateInvitationDeps) =>
  async (input: {
    readonly token: string;
    readonly password: string;
  }): Promise<Result<{ readonly email: string }, ActivateInvitationError>> => {
    const now = deps.clock.now().toISOString();
    const tokenHash = deps.tokens.hashOf(input.token);
    const pending = await deps.invitations.findPendingByTokenHash(
      tokenHash,
      now,
    );
    if (!pending) {
      return err(invitationTokenInvalid('Invalid or expired invitation.'));
    }

    const created = await deps.provisioner.createIdentity({
      email: pending.email,
      password: input.password,
    });
    if (!created.ok) {
      return err(
        created.error.tag === 'app/identity-already-exists'
          ? identityAlreadyExists(
              'An account already exists for this email; sign in instead.',
            )
          : identityProvisionFailed('Could not create the identity.'),
      );
    }

    // Do NOT consume the invitation here. The membership — and the invitation's
    // consumption — are attached atomically by onboarding on FIRST LOGIN
    // (resolveLoginMembership → acceptInvitation), which needs the invitation to
    // still be PENDING. Consuming it now would orphan the activated identity (no
    // membership ever created → it shows up as a "zombie"). Replay is already
    // prevented by the identity-already-exists check above.
    return ok({ email: pending.email });
  };
