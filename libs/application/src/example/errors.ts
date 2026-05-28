import { defineError, type TaggedError } from '@acme/shared';
import type { ItemDomainError } from '@acme/domain';

/**
 * Application-level errors.
 *
 * The use cases can fail for two reasons: a domain rule was violated (wrapped
 * straight through from the domain) or an orchestration concern failed — most
 * commonly "the thing you asked for does not exist". Infrastructure failures
 * (network, disk) surface as thrown exceptions from adapters and are caught at
 * the edge; the *expected* application errors live in this union.
 */
export const itemNotFound = defineError('app/item-not-found');

export type ItemUseCaseError =
  | ItemDomainError
  | TaggedError<'app/item-not-found'>;
