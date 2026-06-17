import { describe, expect, it } from 'vitest';
import type { AccessPermission } from '@acme/domain';
import { exploreBfs } from './property';
import { actorWith, decide } from './access-fixtures';

/**
 * Exhaustive BFS model-check of the soft-block lifecycle. State = the four
 * orthogonal denial sources {account/identity/membership soft-block, account
 * disabled}; transitions = block/unblock/disable/enable each. We explore EVERY
 * reachable state and assert the safety invariant: a gated action is allowed
 * ⇒ no soft-block is active AND the account is active (plus non-vacuity: the
 * fully-clean state with a matching permission IS allowed).
 */
type S = {
  readonly accountBlocked: boolean;
  readonly identityBlocked: boolean;
  readonly membershipBlocked: boolean;
  readonly accountDisabled: boolean;
};

const CLEAN: S = {
  accountBlocked: false,
  identityBlocked: false,
  membershipBlocked: false,
  accountDisabled: false,
};

const allowedIn = (s: S): boolean =>
  decide(
    actorWith({
      permissions: [{ action: 'audit.read', scope: 'own' } as AccessPermission],
      blocked: s.accountBlocked || s.identityBlocked || s.membershipBlocked,
      accountStatus: s.accountDisabled ? 'disabled' : 'active',
    }),
    'audit.read',
    'acct-own',
  ).allowed;

const isClean = (s: S): boolean =>
  !s.accountBlocked &&
  !s.identityBlocked &&
  !s.membershipBlocked &&
  !s.accountDisabled;

describe('formal: soft-block lifecycle (model-check)', () => {
  it('every reachable state holds: allowed ⇒ no block ∧ account active', () => {
    const result = exploreBfs<S>({
      start: [CLEAN],
      key: (s) =>
        `${+s.accountBlocked}${+s.identityBlocked}${+s.membershipBlocked}${+s.accountDisabled}`,
      next: (s) => [
        { ...s, accountBlocked: !s.accountBlocked },
        { ...s, identityBlocked: !s.identityBlocked },
        { ...s, membershipBlocked: !s.membershipBlocked },
        { ...s, accountDisabled: !s.accountDisabled },
      ],
      invariant: (s) => (allowedIn(s) ? isClean(s) : true),
    });
    expect(result.explored).toBe(16);
    expect(result.violation).toBeNull();
  });

  it('is not vacuous — the clean state with a matching permission is allowed', () => {
    expect(allowedIn(CLEAN)).toBe(true);
  });
});
