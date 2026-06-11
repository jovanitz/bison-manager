import { defineError, type TaggedError } from '@acme/shared';
import type { AccessDomainError } from '@acme/domain';

export const invalidAccessToken = defineError('app/invalid-access-token');

export type IdentityUseCaseError =
  | AccessDomainError
  | TaggedError<'app/invalid-access-token'>;
