import {
  ACCESS_ACTIONS,
  evaluateAccessPolicy,
  type AccessAction,
  type AccessActor,
  type AccessPermission,
  type AccessResource,
} from '@acme/domain';
import { chance, pick, type Rng } from './property';

/** Shared builders for the access formal specs (spec-only, dependency-free). */
export const ACCOUNTS = ['acct-own', 'acct-other', 'acct-third'] as const;
export const SCOPES = ['own', 'any'] as const;
export const NOW = '2026-06-16T00:00:00.000Z';
export const FUTURE = '2999-01-01T00:00:00.000Z';

const id = <T>(raw: string): T => raw as T;

export const actorWith = (o: {
  readonly permissions: ReadonlyArray<AccessPermission>;
  readonly accountId?: string;
  readonly blocked?: boolean;
  readonly accountStatus?: AccessActor['accountStatus'];
  readonly sessionStatus?: AccessActor['session']['status'];
  readonly expiresAt?: string;
  readonly isRoot?: boolean;
  readonly isAccountOwner?: boolean;
}): AccessActor => ({
  membership: {
    id: id('m-1'),
    userId: id('u-1'),
    accountId: id(o.accountId ?? 'acct-own'),
  },
  accountStatus: o.accountStatus ?? 'active',
  accountKind: 'staff',
  isRoot: o.isRoot ?? false,
  isAccountOwner: o.isAccountOwner ?? false,
  blocked: o.blocked ?? false,
  session: {
    id: id('s-1'),
    status: o.sessionStatus ?? 'active',
    expiresAt: o.expiresAt ?? FUTURE,
    createdAt: NOW,
  },
  permissions: o.permissions,
  grants: [],
});

export const decide = (
  actor: AccessActor,
  action: AccessAction,
  resourceAccountId: string | null,
) =>
  evaluateAccessPolicy({
    actor,
    action,
    resource: { accountId: resourceAccountId as AccessResource['accountId'] },
    now: NOW,
  });

export const randomPermissions = (rng: Rng): ReadonlyArray<AccessPermission> =>
  ACCESS_ACTIONS.filter(() => chance(rng, 0.25)).map(
    (action) => ({ action, scope: pick(rng, SCOPES) }) as AccessPermission,
  );
