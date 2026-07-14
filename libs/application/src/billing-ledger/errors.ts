import { defineError, type TaggedError } from '@acme/shared';
import type { BillingDomainError } from '@acme/domain';
import type { AccessUseCaseError } from '../access/errors';

/**
 * Ledger denials. A missing subscription fails closed (reuses the
 * billing-subscriptions `app/subscription-not-found` tag — imported where
 * thrown, not re-exported, to keep one source of truth). `app/payment-not-found`
 * guards void/refund of a payment id that isn't on the ledger.
 */
export const paymentNotFound = defineError('app/payment-not-found');

export type BillingLedgerUseCaseError =
  | AccessUseCaseError
  | BillingDomainError
  | TaggedError<'app/subscription-not-found'>
  | TaggedError<'app/payment-not-found'>;
