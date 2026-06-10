import { type Result, err, ok } from '@acme/shared';
import {
  grantNotActive,
  invalidGrantExpiry,
  invalidGrantReason,
} from '../errors';
import type { AccessDomainError } from '../errors';
import type { AccessResource } from '../permission';
import type {
  AccessImpersonationEnded,
  AccessImpersonationStarted,
} from '../events';
import type {
  AccessAction,
  AccessGrantId,
  AccountId,
  MembershipId,
} from '../value-objects';

/**
 * A grant is a *temporary*, scoped, allowlisted elevation of access. It never
 * widens a permission: it enumerates exactly which actions it authorizes
 * (allowlist — never "everything except destructive") and on which single
 * target account. Expired or revoked grants authorize nothing.
 */
export type AccessGrantKind = 'impersonation';

export type AccessGrant = {
  readonly id: AccessGrantId;
  readonly kind: AccessGrantKind;
  /** Who holds the elevated access (e.g. the support agent's membership). */
  readonly membershipId: MembershipId;
  readonly targetAccountId: AccountId;
  readonly actions: ReadonlyArray<AccessAction>;
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  /** Set when the lazy `grant.expired` audit event has been recorded. */
  readonly expiryRecordedAt: string | null;
};

/** Impersonation is view-only by construction: this is the full allowlist. */
export const IMPERSONATION_GRANT_ACTIONS: ReadonlyArray<AccessAction> = [
  'customer.read',
];

export const IMPERSONATION_GRANT_MAX_MINUTES = 60;
const MINUTE_MS = 60_000;
const GRANT_REASON_MAX = 500;

const toMs = (iso: string): number => new Date(iso).getTime();

export const isAccessGrantActive = (grant: AccessGrant, now: string): boolean =>
  grant.revokedAt === null && toMs(grant.expiresAt) > toMs(now);

export const accessGrantAllows = (input: {
  readonly grant: AccessGrant;
  readonly action: AccessAction;
  readonly resource: AccessResource;
  readonly now: string;
}): boolean =>
  isAccessGrantActive(input.grant, input.now) &&
  input.grant.actions.includes(input.action) &&
  input.resource.accountId === input.grant.targetAccountId;

type GrantOutcome<Event> = Result<
  { readonly grant: AccessGrant; readonly event: Event },
  AccessDomainError
>;

export const createImpersonationGrant = (input: {
  readonly id: AccessGrantId;
  readonly membershipId: MembershipId;
  readonly targetAccountId: AccountId;
  readonly reason: string;
  readonly occurredAt: string;
  readonly expiresAt: string;
}): GrantOutcome<AccessImpersonationStarted> => {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    return err(invalidGrantReason('Impersonation requires a reason.'));
  }
  if (reason.length > GRANT_REASON_MAX) {
    return err(
      invalidGrantReason(
        `Grant reason must be at most ${GRANT_REASON_MAX} characters.`,
      ),
    );
  }
  const lifetimeMs = toMs(input.expiresAt) - toMs(input.occurredAt);
  if (Number.isNaN(lifetimeMs) || lifetimeMs <= 0) {
    return err(invalidGrantExpiry('Grant expiry must be in the future.'));
  }
  if (lifetimeMs > IMPERSONATION_GRANT_MAX_MINUTES * MINUTE_MS) {
    return err(
      invalidGrantExpiry(
        `Impersonation grants last at most ${IMPERSONATION_GRANT_MAX_MINUTES} minutes.`,
      ),
    );
  }
  const grant: AccessGrant = {
    id: input.id,
    kind: 'impersonation',
    membershipId: input.membershipId,
    targetAccountId: input.targetAccountId,
    actions: IMPERSONATION_GRANT_ACTIONS,
    reason,
    createdAt: input.occurredAt,
    expiresAt: input.expiresAt,
    revokedAt: null,
    expiryRecordedAt: null,
  };
  return ok({
    grant,
    event: {
      type: 'impersonation.started',
      grantId: grant.id,
      actorMembershipId: grant.membershipId,
      targetAccountId: grant.targetAccountId,
      reason: grant.reason,
      actions: grant.actions,
      expiresAt: grant.expiresAt,
      occurredAt: input.occurredAt,
    },
  });
};

export const endImpersonationGrant = (
  grant: AccessGrant,
  occurredAt: string,
): GrantOutcome<AccessImpersonationEnded> => {
  if (!isAccessGrantActive(grant, occurredAt)) {
    return err(grantNotActive(`Grant ${grant.id} is not active.`));
  }
  const next: AccessGrant = { ...grant, revokedAt: occurredAt };
  return ok({
    grant: next,
    event: {
      type: 'impersonation.ended',
      grantId: next.id,
      actorMembershipId: next.membershipId,
      targetAccountId: next.targetAccountId,
      occurredAt,
    },
  });
};
