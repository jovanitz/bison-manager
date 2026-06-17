import { describe, expect, it } from 'vitest';
import {
  ACCESS_ACTIONS,
  ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
  type AccessPermission,
} from '@acme/domain';
import { guardGrantedPermissions } from '../../access-admin/deps';
import { chance, forAll, pick, type Rng } from './property';

/**
 * Formal verification of `guardGrantedPermissions` — the coherence guard that
 * bounds a customer organization's blast radius. Property: a customer set is
 * ACCEPTED IFF (every scope is `own`) AND (every action is delegable). This is
 * the automated backstop against drift in `ACCESS_CUSTOMER_DELEGABLE_ACTIONS`
 * or the `any`-scope rule — exactly the kind of regression example specs miss.
 */
const SAMPLES = 2000;
const SCOPES = ['own', 'any'] as const;
const DELEGABLE = new Set<string>(ACCESS_CUSTOMER_DELEGABLE_ACTIONS);

const genPermissions = (rng: Rng): ReadonlyArray<AccessPermission> =>
  ACCESS_ACTIONS.filter(() => chance(rng, 0.3)).map(
    (action) => ({ action, scope: pick(rng, SCOPES) }) as AccessPermission,
  );

const customerAcceptedIffDelegableOwn = (
  perms: ReadonlyArray<AccessPermission>,
): boolean => {
  const expected =
    perms.every((p) => p.scope === 'own') &&
    perms.every((p) => DELEGABLE.has(p.action));
  return guardGrantedPermissions(perms, 'customer').ok === expected;
};

const staffAcceptsAnything = (
  perms: ReadonlyArray<AccessPermission>,
): boolean => guardGrantedPermissions(perms, 'staff').ok === true;

describe('formal: guardGrantedPermissions', () => {
  it('G1 — a customer set is accepted IFF all-own ∧ all-delegable', () => {
    expect(() =>
      forAll(
        'customer ⇔ own∧delegable',
        SAMPLES,
        genPermissions,
        customerAcceptedIffDelegableOwn,
      ),
    ).not.toThrow();
  });

  it('G2 — a staff account accepts any permission set', () => {
    expect(() =>
      forAll('staff ⇒ accept', SAMPLES, genPermissions, staffAcceptsAnything),
    ).not.toThrow();
  });
});
