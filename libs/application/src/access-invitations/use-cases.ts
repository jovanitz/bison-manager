import {
  type Clock,
  type IdGenerator,
  type Result,
  err,
  ok,
} from '@acme/shared';
import { ACCESS_INVITATION_TTL_DAYS, makeAccountId } from '@acme/domain';
import type {
  AccessActor,
  AccessPermission,
  AccountId,
  InvitationId,
  RoleId,
} from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import { guardGrantedPermissions } from '../access-admin/deps';
import { accountNotFound } from '../access-admin/errors';
import type { AccessAdminRepository } from '../access-admin/ports';
import type { RoleStore } from '../access-roles/ports';
import type { NotificationSender } from '../ports/notifications';
import { invalidInvitationEmail, invitationAlreadyPending } from './errors';
import type { AccessInvitationUseCaseError } from './errors';
import {
  guardInvitationRoles,
  looksLikeEmail,
  parseInvitationPermissions,
} from './validation';
import type {
  AccessInvitationStore,
  IdentityProvisioner,
  SecretTokenService,
} from './ports';
import { makeActivateInvitation } from './activate';
import {
  makeListPendingInvitations,
  makeRegenerateInvitationLink,
  makeRevokeInvitation,
} from './pending/pending';
import { makeResendInvitation } from './pending/resend';
import type { InvitationLinks } from './pending/resend';

export type AccessInvitationsDeps = {
  readonly invitations: AccessInvitationStore;
  readonly accounts: Pick<AccessAdminRepository, 'findAccount'>;
  readonly roles: Pick<RoleStore, 'findManyById'>;
  readonly tokens: SecretTokenService;
  readonly provisioner: IdentityProvisioner;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Outbound email (invitation resend today; billing dunning next). */
  readonly notifications: NotificationSender;
  readonly links: InvitationLinks;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Issue the token, persist the invitation + its `invitation.created` event. */
const persistNewInvitation = async (
  deps: AccessInvitationsDeps,
  input: {
    readonly actor: AccessActor;
    readonly accountId: AccountId;
    readonly email: string;
    readonly permissions: ReadonlyArray<AccessPermission>;
    readonly roleIds: ReadonlyArray<RoleId>;
    readonly now: string;
  },
): Promise<{ readonly invitationId: InvitationId; readonly token: string }> => {
  const invitationId = deps.ids.next() as InvitationId;
  const expiresAt = new Date(
    deps.clock.now().getTime() + ACCESS_INVITATION_TTL_DAYS * DAY_MS,
  ).toISOString();
  const { token, tokenHash } = deps.tokens.issue();
  const shared = {
    invitationId,
    accountId: input.accountId,
    email: input.email,
    permissions: input.permissions,
    roleIds: input.roleIds,
    expiresAt,
  };
  const actorMembershipId = input.actor.membership.id;
  await deps.invitations.createInvitation(
    {
      ...shared,
      invitedBy: actorMembershipId,
      createdAt: input.now,
      tokenHash,
    },
    {
      ...shared,
      type: 'invitation.created',
      actorMembershipId,
      occurredAt: input.now,
    },
  );
  return { invitationId, token };
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
    readonly roleIds?: ReadonlyArray<string>;
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
    const permissions = parseInvitationPermissions(input.permissions);
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
    const roleIds = await guardInvitationRoles(
      deps.roles,
      accountId.value,
      account.kind,
      input.roleIds ?? [],
    );
    if (!roleIds.ok) return err(roleIds.error);
    if (await deps.invitations.findPendingByEmail(email, now)) {
      return err(
        invitationAlreadyPending(`An invitation for ${email} is pending.`),
      );
    }

    // The plaintext token is returned exactly once, to build the link.
    return ok(
      await persistNewInvitation(deps, {
        actor: input.actor,
        accountId: accountId.value,
        email,
        permissions: permissions.value,
        roleIds: roleIds.value,
        now,
      }),
    );
  };

export type AccessInvitationsUseCases = {
  readonly createInvitation: ReturnType<typeof makeCreateInvitation>;
  readonly activateInvitation: ReturnType<typeof makeActivateInvitation>;
  readonly listPendingInvitations: ReturnType<
    typeof makeListPendingInvitations
  >;
  readonly regenerateInvitationLink: ReturnType<
    typeof makeRegenerateInvitationLink
  >;
  readonly revokeInvitation: ReturnType<typeof makeRevokeInvitation>;
  readonly resendInvitation: ReturnType<typeof makeResendInvitation>;
};

export const makeAccessInvitationsUseCases = (
  deps: AccessInvitationsDeps,
): AccessInvitationsUseCases => ({
  createInvitation: makeCreateInvitation(deps),
  activateInvitation: makeActivateInvitation(deps),
  listPendingInvitations: makeListPendingInvitations(deps),
  regenerateInvitationLink: makeRegenerateInvitationLink(deps),
  revokeInvitation: makeRevokeInvitation(deps),
  resendInvitation: makeResendInvitation(deps),
});
