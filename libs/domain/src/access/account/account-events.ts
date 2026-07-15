import type { AccountId, MembershipId } from '../value-objects';

/** Account-lifecycle events: disable/enable and the customer↔staff promote/demote pair. */
export type AccessAccountDisabled = {
  readonly type: 'account.disabled';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly reason: string | null;
  readonly occurredAt: string;
};

/** A disabled account was re-enabled (the undo of account.disabled). Its
 * sessions were never touched: whatever has not expired resumes working —
 * idle TTLs keep running in real time, so long suspensions die naturally. */
export type AccessAccountEnabled = {
  readonly type: 'account.enabled';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/** A customer account became staff: strict session policy, never listed in
 * the customer directory (and therefore never impersonable) again. */
export type AccessAccountPromoted = {
  readonly type: 'account.promoted';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/**
 * The inverse of promotion: a staff account returned to customer. Its staff-grade
 * permissions are STRIPPED in the same transaction (a customer account may not
 * hold `any`-scoped or staff-only actions), and it becomes customer-directory
 * visible (and impersonable) again. Never emitted for the root's account.
 */
export type AccessAccountDemoted = {
  readonly type: 'account.demoted';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/**
 * An org was marked for deletion (billing-lifecycle policy). `purgeAt` is when
 * the reversible grace window elapses and operational data is purged (the LEDGER
 * is retained — MX fiscal law). Fully cancellable until then.
 */
export type AccessAccountDeletionScheduled = {
  readonly type: 'account.deletion-scheduled';
  readonly accountId: AccountId;
  readonly purgeAt: string;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};

/** A scheduled deletion was withdrawn — the org is fully active again. */
export type AccessAccountDeletionCanceled = {
  readonly type: 'account.deletion-canceled';
  readonly accountId: AccountId;
  readonly actorMembershipId: MembershipId;
  readonly occurredAt: string;
};
