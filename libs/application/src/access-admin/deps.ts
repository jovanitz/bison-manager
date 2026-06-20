import { type Clock, type Result, err, ok } from '@acme/shared';
import { isCustomerDelegableAction, makeAccessPermission } from '@acme/domain';
import type {
  AccessActor,
  AccessPermission,
  AccountId,
  AccountKind,
  MembershipId,
} from '@acme/domain';
import { accessDenied } from '../access/errors';
import type { AccessSessionPolicyStore } from '../access-settings/ports';
import { notDelegableToCustomer, requiresStaffAccount } from './errors';
import type { AccessAdminUseCaseError } from './errors';
import type { AccessAdminRepository } from './ports';

/**
 * Shared dependency set of the access-admin use cases. Lives apart from the
 * use-case factories so `use-cases.ts` and `session-use-cases.ts` both depend
 * on it without depending on each other.
 */
export type AccessAdminDeps = {
  readonly admin: AccessAdminRepository;
  readonly settings: Pick<AccessSessionPolicyStore, 'loadSessionPolicies'>;
  readonly clock: Clock;
};

/**
 * The governing capability of an account: holding `permissions.update` (at any
 * scope) is root-equivalent — whoever has it can re-grant everything else.
 * The anti-orphan rule protects "every account keeps at least one of these".
 */
export const holdsAdminCapability = (
  permissions: ReadonlyArray<AccessPermission>,
): boolean => permissions.some((p) => p.action === 'permissions.update');

/**
 * The super-admin protection: a mutation whose TARGET is the root membership
 * (or an account hosting it) is refused unless the actor is itself the root.
 * There is exactly one root, so `actor.isRoot` means "this very super-admin".
 * Permissions never override this — an invited member granted the owner's full
 * permission set still cannot disable, demote, expel, re-permission or sign out
 * the super-admin.
 */
export const guardRootTarget = (input: {
  readonly targetIsRoot: boolean;
  readonly actor: AccessActor;
}): Result<void, AccessAdminUseCaseError> => {
  if (input.targetIsRoot && !input.actor.isRoot) {
    // Denied with the SAME generic access-denied as any other refusal — never
    // a distinct tag — so the response can't be used to discover who is root.
    return err(accessDenied('The super-admin cannot be modified.'));
  }
  return ok(undefined);
};

/**
 * Account-owner protection (ADR-0011 ownership flag): a mutation whose TARGET is
 * the account owner is refused for a SAME-account member who is not themselves
 * an owner — a co-admin granted the owner's full permission set still cannot
 * re-permission, reset the roles of, or expel the owner. Self, a fellow owner of
 * the same account, and root (or out-of-account staff the policy already
 * authorized) are allowed. Generic access-denied, like every other refusal.
 */
export const guardOwnerTarget = (input: {
  readonly target: {
    readonly isAccountOwner: boolean;
    readonly accountId: AccountId;
    readonly membershipId: MembershipId;
  };
  readonly actor: AccessActor;
}): Result<void, AccessAdminUseCaseError> => {
  const { target, actor } = input;
  if (!target.isAccountOwner) return ok(undefined);
  if (actor.isRoot) return ok(undefined);
  if (actor.membership.id === target.membershipId) return ok(undefined);
  const sameAccountPeer =
    actor.membership.accountId === target.accountId && !actor.isAccountOwner;
  if (sameAccountPeer) {
    return err(accessDenied('The account owner is protected.'));
  }
  return ok(undefined);
};

/**
 * Coherence guards for handing permissions into an account — shared by
 * `permissions.update` and `members.invite` so the rule cannot drift apart:
 * - `any` scope is staff-grade: a customer-kind account (lax sessions,
 *   impersonable) must never hold it — promote the account first.
 * - A customer organization may only hold the delegable subset of actions
 *   (`ACCESS_CUSTOMER_DELEGABLE_ACTIONS`); platform machinery like disabling
 *   accounts or impersonation stays staff-only, not even the owner can hand
 *   it inside an organization.
 */
export const guardGrantedPermissions = (
  permissions: ReadonlyArray<AccessPermission>,
  accountKind: AccountKind,
): Result<void, AccessAdminUseCaseError> => {
  if (accountKind !== 'customer') return ok(undefined);
  if (permissions.some((p) => p.scope === 'any')) {
    return err(
      requiresStaffAccount(
        'any-scoped permissions require a staff account (account.promote first).',
      ),
    );
  }
  const blocked = permissions.find((p) => !isCustomerDelegableAction(p.action));
  if (blocked) {
    return err(
      notDelegableToCustomer(
        `"${blocked.action}" is staff-only and cannot be granted inside a customer organization.`,
      ),
    );
  }
  return ok(undefined);
};

/** Boundary validation: external permission input becomes typed only here. */
export const parseGrantedPermissions = (
  raw: ReadonlyArray<{ readonly action: string; readonly scope: string }>,
): Result<ReadonlyArray<AccessPermission>, AccessAdminUseCaseError> => {
  const permissions: AccessPermission[] = [];
  for (const entry of raw) {
    const permission = makeAccessPermission(entry);
    if (!permission.ok) return err(permission.error);
    permissions.push(permission.value);
  }
  return ok(permissions);
};
