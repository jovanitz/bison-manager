import { type Result, err, ok } from '@acme/shared';
import type { AccessActor } from '@acme/domain';
import { loadAuthorizedAccount } from './deps';
import type { AccessAdminDeps } from './deps';
import { makeUpdateUserPermissions } from './mutations/permissions-use-cases';
import {
  makeListSessions,
  makeRevokeAllSessions,
  makeRevokeSession,
} from './mutations/session-use-cases';
import {
  makeCancelAccountDeletion,
  makeScheduleAccountDeletion,
} from './mutations/deletion-use-cases';
import {
  accountAlreadyDisabled,
  accountAlreadyCustomer,
  accountAlreadyStaff,
  cannotDemoteRoot,
  accountNotDisabled,
} from './errors';
import type { AccessAdminUseCaseError } from './errors';

export type { AccessAdminDeps } from './deps';

type AdminResult = Promise<Result<void, AccessAdminUseCaseError>>;


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

/** The inverse of promotion: staff → customer, staff permissions stripped. */
export const makeDemoteAccountToCustomer =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): AdminResult => {
    const loaded = await loadAuthorizedAccount(deps, input, 'account.demote');
    if (!loaded.ok) return err(loaded.error);
    const { account, now } = loaded.value;
    if (account.kind === 'customer') {
      return err(
        accountAlreadyCustomer(`Account ${input.accountId} is a customer.`),
      );
    }
    // Defense in depth: loadAuthorizedAccount already blocks touching the root's
    // account, but demotion is severe enough to name the refusal explicitly.
    if (account.hostsRoot) {
      return err(cannotDemoteRoot('The root account cannot be demoted.'));
    }

    const policies = await deps.settings.loadSessionPolicies();
    await deps.admin.demoteAccountToCustomer(
      account.id,
      {
        type: 'account.demoted',
        accountId: account.id,
        actorMembershipId: input.actor.membership.id,
        occurredAt: now,
      },
      policies.customer,
    );
    return ok(undefined);
  };

export { makeUpdateUserPermissions };

export type AccessAdminUseCases = {
  readonly disableAccount: ReturnType<typeof makeDisableAccount>;
  readonly enableAccount: ReturnType<typeof makeEnableAccount>;
  readonly promoteAccountToStaff: ReturnType<typeof makePromoteAccountToStaff>;
  readonly demoteAccountToCustomer: ReturnType<
    typeof makeDemoteAccountToCustomer
  >;
  readonly scheduleAccountDeletion: ReturnType<
    typeof makeScheduleAccountDeletion
  >;
  readonly cancelAccountDeletion: ReturnType<typeof makeCancelAccountDeletion>;
  readonly updateUserPermissions: ReturnType<typeof makeUpdateUserPermissions>;
  readonly revokeSession: ReturnType<typeof makeRevokeSession>;
  readonly revokeAllSessions: ReturnType<typeof makeRevokeAllSessions>;
  readonly listSessions: ReturnType<typeof makeListSessions>;
};

export {
  makeListSessions,
  makeRevokeAllSessions,
  makeRevokeSession,
} from './mutations/session-use-cases';

export const makeAccessAdminUseCases = (
  deps: AccessAdminDeps,
): AccessAdminUseCases => ({
  disableAccount: makeDisableAccount(deps),
  enableAccount: makeEnableAccount(deps),
  promoteAccountToStaff: makePromoteAccountToStaff(deps),
  demoteAccountToCustomer: makeDemoteAccountToCustomer(deps),
  scheduleAccountDeletion: makeScheduleAccountDeletion(deps),
  cancelAccountDeletion: makeCancelAccountDeletion(deps),
  updateUserPermissions: makeUpdateUserPermissions(deps),
  revokeSession: makeRevokeSession(deps),
  revokeAllSessions: makeRevokeAllSessions(deps),
  listSessions: makeListSessions(deps),
});
