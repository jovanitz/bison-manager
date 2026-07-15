import { type Result, err, ok } from '@acme/shared';
import { ACCOUNT_DELETION_WINDOW_DAYS } from '@acme/domain';
import type { AccessActor } from '@acme/domain';
import { loadAuthorizedAccount } from '../deps';
import type { AccessAdminDeps } from '../deps';
import {
  cannotDeleteRoot,
  deletionAlreadyScheduled,
  deletionNotScheduled,
} from '../errors';
import type { AccessAdminUseCaseError } from '../errors';

type AdminResult = Promise<Result<void, AccessAdminUseCaseError>>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule an org for deletion (billing-lifecycle policy): a staged soft-delete
 * with a reversible grace window. Staff-only, and OWNER-UNBYPASSABLE — an org
 * owner must never schedule their own org's deletion through the bypass. The
 * actual purge (operational data removed, LEDGER retained for MX fiscal law) is
 * a separate step once `purgeAt` elapses.
 */
export const makeScheduleAccountDeletion =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): AdminResult => {
    const loaded = await loadAuthorizedAccount(deps, input, 'account.delete');
    if (!loaded.ok) return err(loaded.error);
    const { account, now } = loaded.value;
    // Defense in depth: loadAuthorizedAccount already blocks the root account.
    if (account.hostsRoot) {
      return err(cannotDeleteRoot('The root account cannot be deleted.'));
    }
    if (account.pendingDeletionUntil !== null) {
      return err(
        deletionAlreadyScheduled(
          `Account ${input.accountId} is already scheduled for deletion.`,
        ),
      );
    }

    const purgeAt = new Date(
      deps.clock.now().getTime() + ACCOUNT_DELETION_WINDOW_DAYS * DAY_MS,
    ).toISOString();
    await deps.admin.scheduleAccountDeletion(account.id, purgeAt, {
      type: 'account.deletion-scheduled',
      accountId: account.id,
      purgeAt,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    return ok(undefined);
  };

/** Withdraw a scheduled deletion; the org returns to fully active. */
export const makeCancelAccountDeletion =
  (deps: AccessAdminDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly accountId: string;
  }): AdminResult => {
    const loaded = await loadAuthorizedAccount(deps, input, 'account.delete');
    if (!loaded.ok) return err(loaded.error);
    const { account, now } = loaded.value;
    if (account.pendingDeletionUntil === null) {
      return err(
        deletionNotScheduled(
          `Account ${input.accountId} is not scheduled for deletion.`,
        ),
      );
    }

    await deps.admin.cancelAccountDeletion(account.id, {
      type: 'account.deletion-canceled',
      accountId: account.id,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    });
    return ok(undefined);
  };
