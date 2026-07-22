import { type Brand, type Result, err, ok } from '@acme/shared';
import { invalidAccessAction, invalidAccessId } from './errors';
import type { AccessDomainError } from './errors';

/**
 * Identity brands for the access module. Branded so the compiler refuses to
 * pass a `SessionId` where an `AccountId` is expected — cheap insurance in a
 * module where mixing up "who" and "whose" is a security bug.
 */
export type UserId = Brand<string, 'UserId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type MembershipId = Brand<string, 'MembershipId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type AccessGrantId = Brand<string, 'AccessGrantId'>;
export type InvitationId = Brand<string, 'InvitationId'>;
export type RoleId = Brand<string, 'RoleId'>;

const makeNonEmptyId = (raw: string): Result<string, AccessDomainError> => {
  const value = raw.trim();
  if (value.length === 0) {
    return err(invalidAccessId('Access ids must not be empty.'));
  }
  return ok(value);
};

export const makeUserId = (raw: string): Result<UserId, AccessDomainError> =>
  makeNonEmptyId(raw) as Result<UserId, AccessDomainError>;

export const makeAccountId = (
  raw: string,
): Result<AccountId, AccessDomainError> =>
  makeNonEmptyId(raw) as Result<AccountId, AccessDomainError>;

export const makeMembershipId = (
  raw: string,
): Result<MembershipId, AccessDomainError> =>
  makeNonEmptyId(raw) as Result<MembershipId, AccessDomainError>;

export const makeSessionId = (
  raw: string,
): Result<SessionId, AccessDomainError> =>
  makeNonEmptyId(raw) as Result<SessionId, AccessDomainError>;

export const makeAccessGrantId = (
  raw: string,
): Result<AccessGrantId, AccessDomainError> =>
  makeNonEmptyId(raw) as Result<AccessGrantId, AccessDomainError>;

export const makeRoleId = (raw: string): Result<RoleId, AccessDomainError> =>
  makeNonEmptyId(raw) as Result<RoleId, AccessDomainError>;

/**
 * The closed set of authorizable actions. Authorization is deny-by-default:
 * an action that is not in this union cannot even be expressed, let alone
 * allowed. New capabilities extend this list (and the presets/policies that
 * reference it) — they never bypass it.
 *
 * ADR-0017: this is the EXISTING giro's vocabulary, not "the platform's" —
 * each giro injects its own (`AccessConfig`, see `apps/app-b/src/access.ts`);
 * per-giro injection through the application slices = ADR-0015 fase 0b
 * (pending until a second giro needs it).
 */
export const ACCESS_ACTIONS = [
  'account.disable',
  'account.enable',
  'account.promote',
  'account.demote',
  'account.delete',
  'permissions.update',
  'sessions.revoke',
  'sessions.read',
  'staff.read',
  'access.block',
  'customer.search',
  'customer.read',
  'impersonation.start',
  'impersonation.end',
  'audit.read',
  'settings.update',
  'members.invite',
  'members.read',
  'members.remove',
  'members.block',
  'plans.manage',
  'billing.read',
  /**
   * Purge an ORPHAN auth identity (no membership anywhere). Its own action, not
   * a reuse of `staff.read`: listing orphans is a read, erasing a person's
   * identity is destructive and irreversible, and the two must not share a key.
   */
  'identity.delete',
] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];

/**
 * Actions that are NEVER held as a permission — authorized only by a temporary,
 * audited grant (ADR-0010: reading a customer's data is always behind a
 * time-boxed impersonation grant). The ownership bypass (ADR-0011) excludes
 * these, so EVEN root/owner must hold a grant to perform them — the audit trail
 * is never bypassable.
 */
export const GRANT_ONLY_ACTIONS = ['customer.read'] as const;

export const isGrantOnlyAction = (action: AccessAction): boolean =>
  (GRANT_ONLY_ACTIONS as ReadonlyArray<AccessAction>).includes(action);

/**
 * Actions the OWNERSHIP bypass (ADR-0011) never satisfies. Owning an org lets
 * you ADMINISTER it; it does NOT let you cross the customer→staff trust boundary
 * or moderate your account's platform standing. Promoting to staff, or
 * disabling/enabling an account, require real staff authority (a permission) —
 * never ownership.
 *
 * Without this, a self-signup org creator (who onboarding makes `isAccountOwner`
 * on their own account) could `account.promote` THEIR OWN account to staff via
 * the bypass; once staff, the customer-coherence guard — which only restricts
 * customer accounts — stops applying, and they could grant themselves any staff
 * action (up to the irreversible `identity.delete`). The exclusion is on the
 * OWNER branch only: root, the platform super-admin, is unaffected.
 */
export const OWNER_UNBYPASSABLE_ACTIONS = [
  'account.promote',
  'account.demote',
  'account.disable',
  'account.enable',
  // Scheduling/cancelling an org's deletion is staff moderation, never a
  // self-service action an org owner performs on their own account.
  'account.delete',
  // `plans.manage` gates the per-account billing levers (mark-paid, change-plan,
  // set-override, void, refund). It is deliberately NOT customer-delegable, so
  // the ownership bypass was the ONLY path a customer reached it — self-comping
  // a free/premium subscription or refunding real money. Staff reach it by an
  // `any`-scoped permission; owners must not reach it by ownership.
  'plans.manage',
] as const satisfies ReadonlyArray<AccessAction>;

export const isOwnerUnbypassableAction = (action: AccessAction): boolean =>
  (OWNER_UNBYPASSABLE_ACTIONS as ReadonlyArray<AccessAction>).includes(action);

/**
 * Boundary validation against a given action catalog (ADR-0015: vocabulary
 * injection). Generic over the catalog, so a different app validates and
 * narrows to ITS own action union, reusing this one parser.
 */
export const makeAccessActionIn = <Action extends string>(
  raw: string,
  catalog: ReadonlyArray<Action>,
): Result<Action, AccessDomainError> => {
  const match = catalog.find((action) => action === raw);
  if (!match) {
    return err(invalidAccessAction(`Unknown access action "${raw}".`));
  }
  return ok(match);
};

/** This app's boundary validator — validates against `ACCESS_ACTIONS`. */
export const makeAccessAction = (
  raw: string,
): Result<AccessAction, AccessDomainError> =>
  makeAccessActionIn(raw, ACCESS_ACTIONS);
