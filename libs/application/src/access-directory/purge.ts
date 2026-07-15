import { type Clock, type Result, err, ok } from '@acme/shared';
import type { AccessActor, AccessIdentityDeleted, UserId } from '@acme/domain';
import { authorizeAccessAction } from '../access/authorize';
import type { AccessAuditTrail } from '../audit-trail/ports';
import type { AccessMemberDirectory } from '../access-members/ports';
import type { AccessInvitationStore } from '../access-invitations/ports';
import { identityNotOrphan } from './errors';
import type { PurgeIdentityError } from './errors';
import type { IdentityPurger, StaffDirectory } from './ports';

export type PurgeIdentityDeps = {
  readonly staffDirectory: Pick<StaffDirectory, 'listOrphanIdentities'>;
  readonly members: Pick<AccessMemberDirectory, 'listMembershipsByUser'>;
  readonly invitations: Pick<AccessInvitationStore, 'findPendingByEmail'>;
  readonly purger: IdentityPurger;
  readonly auditTrail: Pick<AccessAuditTrail, 'append'>;
  readonly clock: Clock;
};

/**
 * Purge an orphan identity — a sign-up that never joined any organization.
 *
 * The delete is IRREVERSIBLE and lands in the auth provider, so the server never
 * trusts the caller's `userId`: the client read it from a list that may be
 * seconds stale (the person could have accepted an invitation in the meantime),
 * and deleting a real member's identity would be unrecoverable. So we re-derive
 * orphanhood here, twice and from two different angles:
 *
 *   1. the provider-backed orphan view must still list this user, and
 *   2. the membership directory must return NO membership for them.
 *
 * (1) alone could be stale; (2) alone cannot supply the email the audit needs
 * once the identity is gone. Either check failing refuses the delete.
 *
 * A third guard exists because an orphan is one login away from a membership: if
 * an invitation is waiting for their email they could accept it in the check→delete
 * window, so we also refuse to purge an identity with a pending invitation.
 *
 * The window cannot be closed in the app alone (the delete lands in a different
 * system), so the DATABASE is the real backstop: `memberships.user_id` is now
 * `references auth.users(id) ON DELETE RESTRICT` (was CASCADE), so deleting an
 * identity that gained ANY membership in the race FAILS at the FK instead of
 * silently destroying that membership — and the purger fails closed on it.
 *
 * Unlike the other sensitive writes this cannot be transactional — the mutation
 * is in the auth provider, the audit record is in our database. The event is
 * appended only after a CONFIRMED delete, so the trail records what happened,
 * never what was merely attempted.
 */
export const makePurgeOrphanIdentity =
  (deps: PurgeIdentityDeps) =>
  async (input: {
    readonly actor: AccessActor;
    readonly userId: string;
  }): Promise<Result<void, PurgeIdentityError>> => {
    const now = deps.clock.now().toISOString();

    const authorized = authorizeAccessAction({
      actor: input.actor,
      action: 'identity.delete',
      resource: { accountId: null },
      now,
    });
    if (!authorized.ok) return err(authorized.error);

    const orphans = await deps.staffDirectory.listOrphanIdentities();
    const orphan = orphans.find((o) => o.userId === input.userId);
    if (!orphan) {
      return err(
        identityNotOrphan(`${input.userId} is not an orphan identity.`),
      );
    }

    // Second, independent check: an identity that holds ANY membership is a
    // real member, whatever a stale orphan view says.
    const memberships = await deps.members.listMembershipsByUser(
      input.userId as UserId,
    );
    if (memberships.length > 0) {
      return err(
        identityNotOrphan(`${input.userId} holds a membership; not an orphan.`),
      );
    }

    // Third guard: an invitation waiting for this email means they are one login
    // away from holding a membership — and the FK cascade would take it with them.
    if (orphan.email) {
      const invited = await deps.invitations.findPendingByEmail(
        orphan.email,
        now,
      );
      if (invited) {
        return err(
          identityNotOrphan(
            `${input.userId} has a pending invitation; purging would race its acceptance.`,
          ),
        );
      }
    }

    const purged = await deps.purger.deleteIdentity(input.userId);
    if (!purged.ok) return err(purged.error);

    const event: AccessIdentityDeleted = {
      type: 'identity.deleted',
      userId: input.userId as UserId,
      // Kept on the event: the identity no longer exists to be looked up.
      email: orphan.email,
      actorMembershipId: input.actor.membership.id,
      occurredAt: now,
    };
    await deps.auditTrail.append(event);
    return ok(undefined);
  };
