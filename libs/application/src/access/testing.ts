import {
  accessPresetPermissions,
  type AccessActor,
  type AccessGrant,
  type AccessPresetName,
  type AccountId,
} from '@acme/domain';

/**
 * Spec fixtures for the access modules. Test-only by convention (imported from
 * `*.spec.ts`), kept here so every access spec builds actors the same way.
 */
export const TEST_ACCESS_NOW = '2026-06-09T12:00:00.000Z';
export const TEST_ACCESS_SESSION_EXPIRY = '2026-06-09T18:00:00.000Z';
export const TEST_ACCESS_SESSION_CREATED = '2026-06-09T11:00:00.000Z';

export const testAccessActor = (input: {
  readonly preset: AccessPresetName;
  readonly membershipId?: string;
  readonly accountId?: string;
  readonly accountStatus?: AccessActor['accountStatus'];
  readonly sessionStatus?: AccessActor['session']['status'];
  readonly grants?: ReadonlyArray<AccessGrant>;
}): AccessActor => ({
  membership: {
    id: (input.membershipId ??
      'membership-1') as AccessActor['membership']['id'],
    userId: 'user-1' as AccessActor['membership']['userId'],
    accountId: (input.accountId ?? 'acct-1') as AccountId,
  },
  accountStatus: input.accountStatus ?? 'active',
  accountKind:
    input.preset === 'customer' || input.preset === 'customer-admin'
      ? 'customer'
      : 'staff',
  session: {
    id: 'session-1' as AccessActor['session']['id'],
    status: input.sessionStatus ?? 'active',
    expiresAt: TEST_ACCESS_SESSION_EXPIRY,
    createdAt: TEST_ACCESS_SESSION_CREATED,
  },
  permissions: accessPresetPermissions(input.preset),
  grants: input.grants ?? [],
});
