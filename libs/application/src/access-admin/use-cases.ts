import { type Result, err, ok } from '@acme/shared';
import { makeAccountId, makeMembershipId } from '@acme/domain';
import type { AccessAction, AccessActor } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import {
  guardGrantedPermissions,
  holdsAdminCapability,
  parseGrantedPermissions,
} from './deps';
import type { AccessAdminDeps } from './deps';
import {
  makeListSessions,
  makeRevokeAllSessions,
  makeRevokeSession,
} from './session-use-cases';
import {
  accountAlreadyDisabled,
  accountAlreadyStaff,
  accountNotDisabled,
  accountNotFound,
  cannotOrphanAccount,
  membershipNotFound,
} from './errors';
import type { AccessAdminUseCaseError } from './errors';
import type { AdminAccountSnapshot } from './ports';

export type { AccessAdminDeps } from './deps';

type AdminResult = Promise<Result<void, AccessAdminUseCaseError>>;

/** Shared head of every account mutation: parse, authorize, load (404). */
const loadAuthorizedAccount = async (
  deps: AccessAdminDeps,
  input: { readonly actor: AccessActor; readonly accountId: string },
  action: AccessAction,
): Promise<
  Result<
    { readonly account: AdminAccountSnapshot; readonly now: string },
    AccessAdminUseCaseError
  >
> => {
  const accountId = makeAccountId(input.accountId);
  if (!accountId.ok) return err(accountId.error);
  const now = deps.clock.now().toISOString();

  const authorized = authorizeAccessAction({
    actor: input.actor,
    action,
    resource: { accountId: accountId.value },
    now,
  });
  if (!authorized.ok) return err(authorized.error);

  const account = await deps.admin.findAccount(accountId.value);
  if (!account) return err(accountNotFound(`No account ${input.accountId}.`));
  return ok({ account, now });
};

export const makeDisableAccount =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
    readonly reason?: string;
  }): AdminResult => {
    const loaded = await loadAuthorizedAccount(deps, input, 'account.disable');
    if (!loaded.ok) return err(loaded.error);
    const { account, now } = loaded.value;
    if (account.status === 'disabled') {
      return err(
        accountAlreadyDisabled(`Account ${input.accountId} is disabled.`),
      );
    }

    await deps.admin.disableAccount(account.id, {
      type: 'account.disabled',
      accountId: account.id,
      actorMembershipId: input.actor.membership.id,
      reason: input.reason?.trim() || null,
      occurredAt: now,
    });
    return ok(undefined);
  };

/** Re-enables a disabled account; old sessions stay dead. */
export const makeEnableAccount =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): AdminResult => {
    const loaded = await loadAuthorizedAccount(deps, input, 'account.enable');
    if (!loaded.ok) return err(loaded.error);
    const { account, now } = loaded.value;
    if (account.status !== 'disabled') {
      return err(accountNotDisabled(`Account ${input.accountId} is active.`));
    }

    await deps.admin.enableAccount(account.id, {
      type: 'account.enabled',
      accountId: account.id,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    return ok(undefined);
  };

/** customer → staff: strict sessions, out of the customer directory. */
export const makePromoteAccountToStaff =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): AdminResult => {
    const loaded = await loadAuthorizedAccount(deps, input, 'account.promote');
    if (!loaded.ok) return err(loaded.error);
    const { account, now } = loaded.value;
    if (account.kind === 'staff') {
      return err(accountAlreadyStaff(`Account ${input.accountId} is staff.`));
    }

    const policies = await deps.settings.loadSessionPolicies();
    await deps.admin.promoteAccountToStaff(
      account.id,
      {
        type: 'account.promoted',
        accountId: account.id,
        actorMembershipId: input.actor.membership.id,
        occurredAt: now,
      },
      policies.staff,
    );
    return ok(undefined);
  };

export const makeUpdateUserPermissions =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly membershipId: string;
    readonly permissions: ReadonlyArray<{
      readonly action: string;
      readonly scope: string;
    }>;
  }): AdminResult => {
    const membershipId = makeMembershipId(input.membershipId);
    if (!membershipId.ok) return err(membershipId.error);
    const permissions = parseGrantedPermissions(input.permissions);
    if (!permissions.ok) return err(permissions.error);

    const membership = await deps.admin.findMembership(membershipId.value);
    if (!membership) {
      return err(membershipNotFound(`No membership ${input.membershipId}.`));
    }

    const now = deps.clock.now().toISOString();
    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'permissions.update',
      resource: { accountId: membership.accountId },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const coherent = guardGrantedPermissions(
      permissions.value,
      membership.accountKind,
    );
    if (!coherent.ok) return err(coherent.error);

    // Anti-orphan: only a change that strips the governing capability needs
    // the account to retain another administrator — verified atomically by
    // the adapter (locked count), so concurrent demotions cannot both pass.
    const demotesAdmin =
      holdsAdminCapability(membership.permissions) &&
      !holdsAdminCapability(permissions.value);
    const result = await deps.admin.updatePermissions(
      membership.id,
      permissions.value,
      {
        type: 'permissions.updated',
        membershipId: membership.id,
        actorMembershipId: input.actor.membership.id,
        before: membership.permissions,
        after: permissions.value,
        occurredAt: now,
      },
      demotesAdmin,
    );
    if (result.orphaned) {
      return err(
        cannotOrphanAccount('An account must keep at least one administrator.'),
      );
    }
    return ok(undefined);
  };

export type AccessAdminUseCases = {
  readonly disableAccount: ReturnType<typeof makeDisableAccount>;
  readonly enableAccount: ReturnType<typeof makeEnableAccount>;
  readonly promoteAccountToStaff: ReturnType<typeof makePromoteAccountToStaff>;
  readonly updateUserPermissions: ReturnType<typeof makeUpdateUserPermissions>;
  readonly revokeSession: ReturnType<typeof makeRevokeSession>;
  readonly revokeAllSessions: ReturnType<typeof makeRevokeAllSessions>;
  readonly listSessions: ReturnType<typeof makeListSessions>;
};

export {
  makeListSessions,
  makeRevokeAllSessions,
  makeRevokeSession,
} from './session-use-cases';

export const makeAccessAdminUseCases = (
  deps: AccessAdminDeps,
): AccessAdminUseCases => ({
  disableAccount: makeDisableAccount(deps),
  enableAccount: makeEnableAccount(deps),
  promoteAccountToStaff: makePromoteAccountToStaff(deps),
  updateUserPermissions: makeUpdateUserPermissions(deps),
  revokeSession: makeRevokeSession(deps),
  revokeAllSessions: makeRevokeAllSessions(deps),
  listSessions: makeListSessions(deps),
});
