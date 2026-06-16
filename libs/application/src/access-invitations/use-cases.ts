import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import {
  ACCESS_INVITATION_TTL_DAYS,
  makeAccessPermission,
  makeAccountId,
} from '@acme/domain';
import type { AccessActor, AccessPermission, InvitationId } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { guardGrantedPermissions } from '../access-admin/deps';
import { accountNotFound } from '../access-admin/errors';
import type { AccessAdminRepository } from '../access-admin/ports';
import {
  identityAlreadyExists,
  identityProvisionFailed,
  invalidInvitationEmail,
  invitationAlreadyPending,
  invitationTokenInvalid,
} from './errors';
import type {
  AccessInvitationUseCaseError,
  ActivateInvitationError,
} from './errors';
import type {
  AccessInvitationStore,
  IdentityProvisioner,
  SecretTokenService,
} from './ports';

export type AccessInvitationsDeps = {
  readonly invitations: AccessInvitationStore;
  readonly accounts: Pick<AccessAdminRepository, 'findAccount'>;
  readonly tokens: SecretTokenService;
  readonly provisioner: IdentityProvisioner;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimal linear-time shape check; real validation is the email roundtrip. */
const looksLikeEmail = (email: string): boolean => {
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1 && !/\s/.test(email);
};

const parsePermissions = (
  raw: ReadonlyArray<{ readonly action: string; readonly scope: string }>,
): Result<ReadonlyArray<AccessPermission>, AccessInvitationUseCaseError> => {
  const permissions: AccessPermission[] = [];
  for (const entry of raw) {
    const permission = makeAccessPermission(entry);
    if (!permission.ok) return err(permission.error);
    permissions.push(permission.value);
  }
  return ok(permissions);
};

/** Invite an email into an existing account, with explicit permissions. */
export const makeCreateInvitation =
  (deps: AccessInvitationsDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly email: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }): Promise<
    Result<
      { readonly invitationId: InvitationId; readonly token: string },
      AccessInvitationUseCaseError
    >
  > => {
    const accountId = makeAccountId(input.accountId);
    if (!accountId.ok) return err(accountId.error);
    const email = input.email.trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      return err(invalidInvitationEmail(`Invalid email "${input.email}".`));
    }
    const permissions = parsePermissions(input.permissions);
    if (!permissions.ok) return err(permissions.error);

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'members.invite',
      resource: { accountId: accountId.value },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const account = await deps.accounts.findAccount(accountId.value);
    if (!account) return err(accountNotFound(`No account ${input.accountId}.`));
    // Same coherence rules as permissions.update (shared guard).
    const coherent = guardGrantedPermissions(permissions.value, account.kind);
    if (!coherent.ok) return err(coherent.error);
    if (await deps.invitations.findPendingByEmail(email, now)) {
      return err(
        invitationAlreadyPending(`An invitation for ${email} is pending.`),
      );
    }

    const invitationId = deps.ids.next() as InvitationId;
    const expiresAt = new Date(
      deps.clock.now().getTime() + ACCESS_INVITATION_TTL_DAYS * DAY_MS,
    ).toISOString();
    const { token, tokenHash } = deps.tokens.issue();
    await deps.invitations.createInvitation(
      {
        invitationId,
        accountId: accountId.value,
        email,
        permissions: permissions.value,
        invitedBy: input.actor.membership.id,
        createdAt: now,
        expiresAt,
        tokenHash,
      },
      {
        type: 'invitation.created',
        invitationId,
        accountId: accountId.value,
        email,
        permissions: permissions.value,
        actorMembershipId: input.actor.membership.id,
        expiresAt,
        occurredAt: now,
      },
    );
    // The plaintext token is returned exactly here, once, to build the link.
    return ok({ invitationId, token });
  };

/**
 * Activation (pre-login, no actor): the secret token is the only credential.
 * Hash it, find the live invitation, then create the identity with the chosen
 * password. Fail-closed and generic on a bad/expired/used token (no
 * enumeration); refuse if the email already has an identity (no takeover). The
 * membership itself is attached by the existing onboarding on first login.
 */
export const makeActivateInvitation =
  (deps: AccessInvitationsDeps) =>
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

    await deps.invitations.consumeToken(pending.invitationId);
    return ok({ email: pending.email });
  };

export type AccessInvitationsUseCases = {
  readonly createInvitation: ReturnType<typeof makeCreateInvitation>;
  readonly activateInvitation: ReturnType<typeof makeActivateInvitation>;
};

export const makeAccessInvitationsUseCases = (
  deps: AccessInvitationsDeps,
): AccessInvitationsUseCases => ({
  createInvitation: makeCreateInvitation(deps),
  activateInvitation: makeActivateInvitation(deps),
});
