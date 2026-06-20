import { describe, expect, it } from 'vitest';
import {
  ACCESS_ACTIONS,
  isGrantOnlyAction,
  type AccessAction,
  type AccessPermission,
} from '@acme/domain';
import { forAll, pick, chance, type Rng } from './property';
import {
  ACCOUNTS,
  FUTURE,
  NOW,
  SCOPES,
  actorWith,
  decide,
  randomPermissions,
} from './access-fixtures';

/**
 * Formal verification of the pure authorization core (`evaluateAccessPolicy`):
 * property-based testing over random actors/actions/resources. Deny-by-default
 * and tenant isolation are the security-critical invariants — example specs
 * can't cover the ~18 actions × 2 scopes × tenancy combinatorics; this does.
 * (The soft-block lifecycle is model-checked in `soft-block-lifecycle.formal.spec.ts`.)
 */
const SAMPLES = 2000;

const verify = <T>(
  name: string,
  gen: (rng: Rng) => T,
  prop: (x: T) => boolean,
): void => forAll(name, SAMPLES, gen, prop);

type Case = {
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly action: AccessAction;
  readonly resource: string;
};
const genCase = (rng: Rng): Case => ({
  permissions: randomPermissions(rng),
  action: pick(rng, ACCESS_ACTIONS),
  resource: pick(rng, ACCOUNTS),
});
const blockedDenies = (x: Case): boolean =>
  decide(
    actorWith({ permissions: x.permissions, blocked: true }),
    x.action,
    x.resource,
  ).allowed === false;

type DeadCase = Case & { readonly kill: 'account' | 'session' | 'expired' };
const genDead = (rng: Rng): DeadCase => ({
  ...genCase(rng),
  kill: pick(rng, ['account', 'session', 'expired'] as const),
});
const deadDenies = (x: DeadCase): boolean =>
  decide(
    actorWith({
      permissions: x.permissions,
      accountStatus: x.kill === 'account' ? 'disabled' : 'active',
      sessionStatus: x.kill === 'session' ? 'revoked' : 'active',
      expiresAt: x.kill === 'expired' ? NOW : FUTURE,
    }),
    x.action,
    'acct-own',
  ).allowed === false;

const genUnmatched = (rng: Rng): Case => {
  const action = pick(rng, ACCESS_ACTIONS);
  const permissions = ACCESS_ACTIONS.filter(
    (candidate) => candidate !== action && chance(rng, 0.3),
  ).map(
    (other) =>
      ({ action: other, scope: pick(rng, SCOPES) }) as AccessPermission,
  );
  return { action, permissions, resource: pick(rng, ACCOUNTS) };
};
const unmatchedDenies = (x: Case): boolean =>
  decide(actorWith({ permissions: x.permissions }), x.action, x.resource)
    .allowed === false;

type ScopeCase = {
  readonly action: AccessAction;
  readonly ownAccount: string;
  readonly resource: string;
};
const genScope = (rng: Rng): ScopeCase => ({
  action: pick(rng, ACCESS_ACTIONS),
  ownAccount: pick(rng, ACCOUNTS),
  resource: pick(rng, ACCOUNTS),
});
const ownScopeIffSameAccount = (x: ScopeCase): boolean =>
  decide(
    actorWith({
      accountId: x.ownAccount,
      permissions: [{ action: x.action, scope: 'own' } as AccessPermission],
    }),
    x.action,
    x.resource,
  ).allowed ===
  (x.resource === x.ownAccount);
const anyScopeAllowsAnywhere = (x: ScopeCase): boolean =>
  decide(
    actorWith({
      permissions: [{ action: x.action, scope: 'any' } as AccessPermission],
    }),
    x.action,
    x.resource,
  ).allowed === true;
// ADR-0011: ownership bypass. Authority comes from the identity flag, not a
// permission list — root is omnipotent, an account owner is omnipotent within
// its own account, and the fail-closed gates still beat both.
// Root bypasses every action EXCEPT the grant-only ones (customer data stays
// behind an audited grant, even for root).
const rootAllowsExceptGrantOnly = (x: ScopeCase): boolean =>
  decide(actorWith({ permissions: [], isRoot: true }), x.action, x.resource)
    .allowed === !isGrantOnlyAction(x.action);
const ownerAllowsIffOwnAccount = (x: ScopeCase): boolean =>
  decide(
    actorWith({
      accountId: x.ownAccount,
      permissions: [],
      isAccountOwner: true,
    }),
    x.action,
    x.resource,
  ).allowed === (x.resource === x.ownAccount && !isGrantOnlyAction(x.action));
const deadRootDenies = (x: DeadCase): boolean =>
  decide(
    actorWith({
      permissions: [],
      isRoot: true,
      accountStatus: x.kill === 'account' ? 'disabled' : 'active',
      sessionStatus: x.kill === 'session' ? 'revoked' : 'active',
      expiresAt: x.kill === 'expired' ? NOW : FUTURE,
    }),
    x.action,
    'acct-own',
  ).allowed === false;

describe('formal: evaluateAccessPolicy', () => {
  it('P1 — a blocked actor is denied every action', () => {
    expect(() =>
      verify('blocked ⇒ deny', genCase, blockedDenies),
    ).not.toThrow();
  });

  it('P2 — a dead account or session denies everything', () => {
    expect(() => verify('dead ⇒ deny', genDead, deadDenies)).not.toThrow();
  });

  it('P3 — deny-by-default: no matching permission ⇒ deny', () => {
    expect(() =>
      verify('no match ⇒ deny', genUnmatched, unmatchedDenies),
    ).not.toThrow();
  });

  it('P4 — own-scope authorizes IFF the resource is the actor’s account', () => {
    expect(() =>
      verify('own ⇔ same account', genScope, ownScopeIffSameAccount),
    ).not.toThrow();
  });

  it('P5 — any-scope authorizes regardless of resource account', () => {
    expect(() =>
      verify('any ⇒ allow anywhere', genScope, anyScopeAllowsAnywhere),
    ).not.toThrow();
  });

  it('P6 — root (live) is authorized for every action except grant-only ones', () => {
    expect(() =>
      verify(
        'isRoot ⇒ allow (non-grant-only)',
        genScope,
        rootAllowsExceptGrantOnly,
      ),
    ).not.toThrow();
  });

  it('P7 — an account owner is authorized IFF the resource is its own account', () => {
    expect(() =>
      verify('owner ⇔ own account', genScope, ownerAllowsIffOwnAccount),
    ).not.toThrow();
  });

  it('P8 — fail-closed beats the bypass: a dead/disabled root is denied', () => {
    expect(() =>
      verify('dead root ⇒ deny', genDead, deadRootDenies),
    ).not.toThrow();
  });
});
