import { type Result, err, ok } from '@acme/shared';
import { grantNotExpired } from '../errors';
import type { AccessDomainError } from '../errors';
import type { AccessGrantExpired } from '../events';
import { isAccessGrantActive, type AccessGrant } from './grant';

/**
 * Lazy `grant.expired` recording.
 *
 * Expiry is passive — a timestamp passes, nothing "runs". The audit event is
 * recorded the first time an expired grant is observed (policy evaluation or
 * access queries), and `expiryRecordedAt` deduplicates it. A pg_cron sweep can
 * later call the same functions for punctual recording without design change.
 */
export const findNewlyExpiredAccessGrants = (
  grants: ReadonlyArray<AccessGrant>,
  now: string,
): ReadonlyArray<AccessGrant> =>
  grants.filter(
    (grant) =>
      grant.revokedAt === null &&
      grant.expiryRecordedAt === null &&
      !isAccessGrantActive(grant, now),
  );

export const recordAccessGrantExpiry = (
  grant: AccessGrant,
  occurredAt: string,
): Result<
  { readonly grant: AccessGrant; readonly event: AccessGrantExpired },
  AccessDomainError
> => {
  const isNewlyExpired =
    findNewlyExpiredAccessGrants([grant], occurredAt).length === 1;
  if (!isNewlyExpired) {
    return err(
      grantNotExpired(`Grant ${grant.id} is not pending expiry recording.`),
    );
  }
  const next: AccessGrant = { ...grant, expiryRecordedAt: occurredAt };
  return ok({
    grant: next,
    event: {
      type: 'grant.expired',
      grantId: next.id,
      membershipId: next.membershipId,
      targetAccountId: next.targetAccountId,
      occurredAt,
    },
  });
};
