import { defineError, type TaggedError } from '@acme/shared';
import type { AccessUseCaseError } from '../access/errors';

export const customerNotFound = defineError('app/customer-not-found');
export const impersonationGrantNotFound = defineError(
  'app/impersonation-grant-not-found',
);
export const impersonationGrantNotOwned = defineError(
  'app/impersonation-grant-not-owned',
);

export type ImpersonationUseCaseError =
  | AccessUseCaseError
  | TaggedError<'app/customer-not-found'>
  | TaggedError<'app/impersonation-grant-not-found'>
  | TaggedError<'app/impersonation-grant-not-owned'>;
