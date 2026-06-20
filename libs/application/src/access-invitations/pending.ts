import {
  type Clock,
  type Result,
  type TaggedError,
  err,
  ok,
} from '@acme/shared';
import { ACCESS_INVITATION_TTL_DAYS } from '@acme/domain';
import type { AccessActor, InvitationId } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { invitationTokenInvalid } from './errors';
import type { AccessInvitationUseCaseError } from './errors';
import type {
  AccessInvitationStore,
  PendingInvitationSummary,
  SecretTokenService,
} from './ports';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Just what the pending-list / regenerate flows need (a subset of the full deps). */
type PendingDeps = {
  readonly invitations: Pick<
    AccessInvitationStore,
    'listPending' | 'regenerateToken'
  >;
  readonly tokens: Pick<SecretTokenService, 'issue'>;
  readonly clock: Clock;
};

/** The dashboard's pending-invitations list. Platform read, gated by staff.read. */
export const makeListPendingInvitations =
  (deps: PendingDeps) =>
  async (input: {
    readonly actor: AccessActor;
  }): Promise<
    Result<
      ReadonlyArray<PendingInvitationSummary>,
      AccessInvitationUseCaseError
    >
  > => {
    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'staff.read',
      resource: { accountId: null },
      now,
    });
    if (!authorized.ok) return err(authorized.error);
    return ok(await deps.invitations.listPending(now));
  };

/**
 * Re-issue a fresh one-time link for a still-pending invitation (rotate its
 * token + expiry). Staff action, gated by `members.invite` (any). The new
 * plaintext token is returned once, exactly like creation.
 */
export const makeRegenerateInvitationLink =
  (deps: PendingDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly invitationId: string;
  }): Promise<
    Result<
      { readonly token: string },
      AccessInvitationUseCaseError | TaggedError<'app/invitation-token-invalid'>
    >
  > => {
    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'members.invite',
      resource: { accountId: null },
      now,
    });
    if (!authorized.ok) return err(authorized.error);
    const { token, tokenHash } = deps.tokens.issue();
    const expiresAt = new Date(
      deps.clock.now().getTime() + ACCESS_INVITATION_TTL_DAYS * DAY_MS,
    ).toISOString();
    const rotated = await deps.invitations.regenerateToken(
      input.invitationId as InvitationId,
      { tokenHash, expiresAt },
      now,
    );
    if (!rotated) {
      return err(
        invitationTokenInvalid('No pending invitation to regenerate.'),
      );
    }
    return ok({ token });
  };
