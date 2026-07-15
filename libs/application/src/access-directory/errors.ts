import { defineError, type TaggedError } from '@acme/shared';
import type { AccessUseCaseError } from '../access/errors';

/**
 * The identity is NOT an orphan — it holds a membership somewhere (or does not
 * exist). Refusing here is the whole point: the client sends a userId it read
 * from a list that may be seconds stale, and the delete is irreversible.
 */
export const identityNotOrphan = defineError('app/identity-not-orphan');

/** The auth provider refused or failed the purge. Nothing was deleted. */
export const identityPurgeFailed = defineError('app/identity-purge-failed');

export type PurgeIdentityError =
  | AccessUseCaseError
  | TaggedError<'app/identity-not-orphan'>
  | TaggedError<'app/identity-purge-failed'>;
