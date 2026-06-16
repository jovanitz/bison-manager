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

/**
 * The closed set of authorizable actions. Authorization is deny-by-default:
 * an action that is not in this union cannot even be expressed, let alone
 * allowed. New capabilities extend this list (and the presets/policies that
 * reference it) — they never bypass it.
 */
export const ACCESS_ACTIONS = [
  'account.disable',
  'account.enable',
  'account.promote',
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
] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const makeAccessAction = (
  raw: string,
): Result<AccessAction, AccessDomainError> => {
  const match = ACCESS_ACTIONS.find((action) => action === raw);
  if (!match) {
    return err(invalidAccessAction(`Unknown access action "${raw}".`));
  }
  return ok(match);
};
