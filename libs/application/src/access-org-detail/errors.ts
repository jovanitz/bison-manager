import type { TaggedError } from '@acme/shared';
import type { AccessUseCaseError } from '../access/errors';

/** Errors of the org-detail reads: a denial, or an unknown account. */
export type AccessOrgDetailUseCaseError =
  | AccessUseCaseError
  | TaggedError<'app/account-not-found'>;
