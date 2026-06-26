import { describe, expect, it } from 'vitest';
import { ROLE_TEMPLATES } from '@acme/domain';
import type { AccessPermission, Role, RoleTemplate } from '@acme/domain';
import {
  resolveActorPermissions,
  unionPermissions,
} from '../../access-roles/expand';
import { mergeTemplates } from '../../access-roles/lifecycle/templates';
import { chance, exploreBfs, forAll, pick, type Rng } from './property';

/**
 * Formal verification of the ADR-0011..0014 "final model" transforms that
 * example specs can't exhaust:
 *  - `unionPermissions` (role expansion): a duplicate-free set union.
 *  - `mergeTemplates` (ADR-0013): code catalogue with staff overrides, never
 *    adding or dropping a key.
 *  - the eager template-propagation state machine (ADR-0014): a model check
 *    proving a SYNCED instance always equals its template, so a FORKED one is
 *    never silently rewritten by a staff edit.
 */
const SAMPLES = 2000;
const ACTIONS = ['staff.read', 'audit.read', 'members.read', 'settings.update'];
const SCOPES = ['own', 'any'] as const;
const permKey = (p: AccessPermission) => `${p.action}:${p.scope}`;
const asSet = (ps: ReadonlyArray<AccessPermission>) => new Set(ps.map(permKey));
const setsEqual = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

const genPerms = (rng: Rng): ReadonlyArray<AccessPermission> =>
  ACTIONS.filter(() => chance(rng, 0.4)).map(
    (action) => ({ action, scope: pick(rng, SCOPES) }) as AccessPermission,
  );
const genGroups = (rng: Rng): ReadonlyArray<ReadonlyArray<AccessPermission>> =>
  Array.from({ length: Math.floor(rng() * 4) }, () => genPerms(rng));

const unionIsSetUnion = (
  groups: ReadonlyArray<ReadonlyArray<AccessPermission>>,
): boolean => {
  const out = unionPermissions(...groups);
  const expected = new Set(groups.flatMap((g) => g.map(permKey)));
  return out.length === asSet(out).size && setsEqual(asSet(out), expected);
};
const unionIdempotentCommutative = (
  groups: ReadonlyArray<ReadonlyArray<AccessPermission>>,
): boolean => {
  const once = unionPermissions(...groups);
  const twice = unionPermissions(...groups, ...groups);
  const reversed = unionPermissions(...[...groups].reverse());
  return (
    setsEqual(asSet(once), asSet(twice)) &&
    setsEqual(asSet(once), asSet(reversed))
  );
};

describe('formal: role expansion (unionPermissions)', () => {
  it('U1 — output is duplicate-free and equals the set union of inputs', () => {
    expect(() =>
      forAll('union=set-union', SAMPLES, genGroups, unionIsSetUnion),
    ).not.toThrow();
  });

  it('U2 — idempotent and order-independent (as a set)', () => {
    expect(() =>
      forAll(
        'idempotent+commutative',
        SAMPLES,
        genGroups,
        unionIdempotentCommutative,
      ),
    ).not.toThrow();
  });
});

const genRoles = (rng: Rng): ReadonlyArray<Role> =>
  Array.from(
    { length: Math.floor(rng() * 4) },
    () => ({ permissions: genPerms(rng) }) as Role,
  );

// ADR-0014 roles-only: a membership's effective permissions are EXACTLY the
// duplicate-free union of its roles' permissions — no separate direct list, so
// nothing is added beyond the roles and nothing the roles grant is dropped.
const resolutionIsRoleUnion = (roles: ReadonlyArray<Role>): boolean => {
  const effective = resolveActorPermissions(roles);
  const expected = new Set(roles.flatMap((r) => r.permissions.map(permKey)));
  return (
    effective.length === asSet(effective).size &&
    setsEqual(asSet(effective), expected)
  );
};

describe('formal: roles-only actor resolution (ADR-0014)', () => {
  it('R1 — effective permissions are exactly expand(roleIds), nothing else', () => {
    expect(() =>
      forAll('effective=role-union', SAMPLES, genRoles, resolutionIsRoleUnion),
    ).not.toThrow();
  });
});

const TEMPLATE_KEYS = ROLE_TEMPLATES.map((t) => t.key);
const genOverrides = (rng: Rng): ReadonlyArray<RoleTemplate> =>
  ROLE_TEMPLATES.filter(() => chance(rng, 0.5)).map((t) => ({
    ...t,
    name: `${t.name} (edited)`,
  }));

const mergeKeepsKeysOverrideWins = (
  ovr: ReadonlyArray<RoleTemplate>,
): boolean => {
  const byKey = new Map(mergeTemplates(ovr).map((t) => [t.key, t]));
  const overridden = new Set(ovr.map((t) => t.key));
  const sameKeys =
    byKey.size === TEMPLATE_KEYS.length &&
    TEMPLATE_KEYS.every((k) => byKey.has(k));
  return (
    sameKeys &&
    ROLE_TEMPLATES.every((code) => {
      const want = overridden.has(code.key)
        ? `${code.name} (edited)`
        : code.name;
      return byKey.get(code.key)?.name === want;
    })
  );
};

describe('formal: template merge (mergeTemplates)', () => {
  it('M1 — never adds/drops a key; an override wins, else code', () => {
    expect(() =>
      forAll('merge', SAMPLES, genOverrides, mergeKeepsKeysOverrideWins),
    ).not.toThrow();
  });
});

/**
 * The eager-propagation state machine (ADR-0014). A role instance carries its
 * own permissions (`perms`), its template's current permissions (`tpl`), and a
 * `synced` flag. Operations: a staff edits the template, the org edits the
 * instance (forks it), and reset / apply-to-all (both re-sync to the template).
 */
type Inst = { perms: number; tpl: number; synced: boolean };
const PERMS = [0, 1, 2];
const staffEdit = (s: Inst, t: number): Inst => ({
  tpl: t,
  perms: s.synced ? t : s.perms, // synced follows; forked stays put
  synced: s.synced,
});
const transitions = (s: Inst): ReadonlyArray<Inst> => [
  ...PERMS.map((t) => staffEdit(s, t)),
  ...PERMS.map((p) => ({ ...s, perms: p, synced: false })), // org fork
  { ...s, perms: s.tpl, synced: true }, // reset / apply-to-all
];

const genForkedEdit = (rng: Rng): { s: Inst; t: number } => ({
  s: { perms: pick(rng, PERMS), tpl: pick(rng, PERMS), synced: false },
  t: pick(rng, PERMS),
});
const staffEditLeavesForkUntouched = ({
  s,
  t,
}: {
  s: Inst;
  t: number;
}): boolean => {
  const after = staffEdit(s, t);
  return after.perms === s.perms && after.synced === false;
};

describe('formal: eager template propagation (model check)', () => {
  it('P1 — invariant: a synced instance always equals its template', () => {
    const result = exploreBfs<Inst>({
      start: PERMS.map((t) => ({ perms: t, tpl: t, synced: true })),
      key: (s) => `${s.perms}-${s.tpl}-${s.synced}`,
      next: transitions,
      invariant: (s) => (s.synced ? s.perms === s.tpl : true),
    });
    expect(result.violation).toBeNull();
    expect(result.explored).toBeGreaterThan(0);
  });

  it('P2 — a staff template edit never mutates a FORKED instance', () => {
    expect(() =>
      forAll(
        'fork untouched',
        SAMPLES,
        genForkedEdit,
        staffEditLeavesForkUntouched,
      ),
    ).not.toThrow();
  });
});
