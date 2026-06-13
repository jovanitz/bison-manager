import {
  accessPresetPermissions,
  createImpersonationGrant,
  evaluateAccessPolicy,
} from '@acme/domain';
import type {
  AccessActor,
  AccessGrant,
  AccessPresetName,
  AccountId,
} from '@acme/domain';

/**
 * The decision matrix is not prose: every row below is EXECUTED against the
 * real `evaluateAccessPolicy` when the document is generated. If the policy
 * semantics change, the generated table changes, and the stale-doc check
 * fails the gate until the document is regenerated and reviewed.
 */
const NOW = '2026-01-01T12:00:00.000Z';
const LATER = '2026-01-01T13:00:00.000Z';
const EARLIER = '2026-01-01T11:00:00.000Z';

const OWN_ACCOUNT = 'own-account' as AccountId;
const CUSTOMER_ACCOUNT = 'customer-account' as AccountId;
const OTHER_ACCOUNT = 'other-account' as AccountId;

const actorWith = (input: {
  preset: AccessPresetName;
  accountStatus?: AccessActor['accountStatus'];
  sessionStatus?: AccessActor['session']['status'];
  grants?: ReadonlyArray<AccessGrant>;
}): AccessActor => ({
  membership: {
    id: 'membership-1' as AccessActor['membership']['id'],
    userId: 'user-1' as AccessActor['membership']['userId'],
    accountId: OWN_ACCOUNT,
  },
  accountStatus: input.accountStatus ?? 'active',
  session: {
    id: 'session-1' as AccessActor['session']['id'],
    status: input.sessionStatus ?? 'active',
    expiresAt: LATER,
  },
  permissions: accessPresetPermissions(input.preset),
  grants: input.grants ?? [],
});

const grantOn = (
  target: AccountId,
  occurredAt: string,
  expiresAt: string,
): AccessGrant => {
  const created = createImpersonationGrant({
    id: 'grant-1' as AccessGrant['id'],
    membershipId: 'membership-1' as AccessGrant['membershipId'],
    targetAccountId: target,
    reason: 'documented scenario',
    occurredAt,
    expiresAt,
  });
  if (!created.ok) throw new Error('scenario setup failed');
  return created.value.grant;
};

type Scenario = {
  readonly actor: string;
  readonly state: string;
  readonly check: Parameters<typeof evaluateAccessPolicy>[0];
  readonly target: string;
};

const scenario = (
  actor: string,
  state: string,
  target: string,
  check: Parameters<typeof evaluateAccessPolicy>[0],
): Scenario => ({ actor, state, target, check });

const SCENARIOS: ReadonlyArray<Scenario> = [
  scenario('owner', 'active', 'a customer account', {
    actor: actorWith({ preset: 'owner' }),
    action: 'account.disable',
    resource: { accountId: CUSTOMER_ACCOUNT },
    now: NOW,
  }),
  scenario('owner', 'active', 'audit trail (system)', {
    actor: actorWith({ preset: 'owner' }),
    action: 'audit.read',
    resource: { accountId: null },
    now: NOW,
  }),
  scenario('owner', 'active', 'a customer account', {
    actor: actorWith({ preset: 'owner' }),
    action: 'impersonation.start',
    resource: { accountId: CUSTOMER_ACCOUNT },
    now: NOW,
  }),
  scenario('owner', 'account disabled', 'audit trail (system)', {
    actor: actorWith({ preset: 'owner', accountStatus: 'disabled' }),
    action: 'audit.read',
    resource: { accountId: null },
    now: NOW,
  }),
  scenario('owner', 'session revoked', 'audit trail (system)', {
    actor: actorWith({ preset: 'owner', sessionStatus: 'revoked' }),
    action: 'audit.read',
    resource: { accountId: null },
    now: NOW,
  }),
  scenario('support', 'active', 'customer directory', {
    actor: actorWith({ preset: 'support' }),
    action: 'customer.search',
    resource: { accountId: null },
    now: NOW,
  }),
  scenario('support', 'no grant', 'a customer account', {
    actor: actorWith({ preset: 'support' }),
    action: 'customer.read',
    resource: { accountId: CUSTOMER_ACCOUNT },
    now: NOW,
  }),
  scenario('support', 'active grant on that account', 'the granted account', {
    actor: actorWith({
      preset: 'support',
      grants: [
        grantOn(
          CUSTOMER_ACCOUNT,
          '2026-01-01T11:30:00.000Z',
          '2026-01-01T12:15:00.000Z',
        ),
      ],
    }),
    action: 'customer.read',
    resource: { accountId: CUSTOMER_ACCOUNT },
    now: NOW,
  }),
  scenario('support', 'active grant on that account', 'a DIFFERENT account', {
    actor: actorWith({
      preset: 'support',
      grants: [
        grantOn(
          CUSTOMER_ACCOUNT,
          '2026-01-01T11:30:00.000Z',
          '2026-01-01T12:15:00.000Z',
        ),
      ],
    }),
    action: 'customer.read',
    resource: { accountId: OTHER_ACCOUNT },
    now: NOW,
  }),
  scenario('support', 'grant EXPIRED', 'the granted account', {
    actor: actorWith({
      preset: 'support',
      grants: [grantOn(CUSTOMER_ACCOUNT, EARLIER, '2026-01-01T11:30:00.000Z')],
    }),
    action: 'customer.read',
    resource: { accountId: CUSTOMER_ACCOUNT },
    now: NOW,
  }),
  scenario('support', 'active', 'a customer account', {
    actor: actorWith({ preset: 'support' }),
    action: 'account.disable',
    resource: { accountId: CUSTOMER_ACCOUNT },
    now: NOW,
  }),
  scenario('customer', 'active', 'their OWN account', {
    actor: actorWith({ preset: 'customer' }),
    action: 'customer.read',
    resource: { accountId: OWN_ACCOUNT },
    now: NOW,
  }),
  scenario('customer', 'active', 'ANOTHER account', {
    actor: actorWith({ preset: 'customer' }),
    action: 'customer.read',
    resource: { accountId: OTHER_ACCOUNT },
    now: NOW,
  }),
  scenario('customer', 'active', 'their OWN account', {
    actor: actorWith({ preset: 'customer' }),
    action: 'sessions.revoke',
    resource: { accountId: OWN_ACCOUNT },
    now: NOW,
  }),
  scenario('customer', 'active', 'audit trail (system)', {
    actor: actorWith({ preset: 'customer' }),
    action: 'audit.read',
    resource: { accountId: null },
    now: NOW,
  }),
  scenario('customer-admin', 'active', 'a member of their OWN organization', {
    actor: actorWith({ preset: 'customer-admin' }),
    action: 'members.remove',
    resource: { accountId: OWN_ACCOUNT },
    now: NOW,
  }),
  scenario('customer-admin', 'active', 'a member of ANOTHER organization', {
    actor: actorWith({ preset: 'customer-admin' }),
    action: 'members.remove',
    resource: { accountId: OTHER_ACCOUNT },
    now: NOW,
  }),
  scenario('customer-admin', 'active', "their OWN organization's audit slice", {
    actor: actorWith({ preset: 'customer-admin' }),
    action: 'audit.read',
    resource: { accountId: OWN_ACCOUNT },
    now: NOW,
  }),
  scenario('customer-admin', 'active', 'audit trail (system)', {
    actor: actorWith({ preset: 'customer-admin' }),
    action: 'audit.read',
    resource: { accountId: null },
    now: NOW,
  }),
];

export const renderDecisionMatrix = (): string => {
  const rows = SCENARIOS.map((s) => {
    const decision = evaluateAccessPolicy(s.check);
    const verdict = decision.allowed
      ? `✅ allowed (via ${decision.source})`
      : `⛔ denied — ${decision.reason}`;
    return `| ${s.actor} | ${s.state} | \`${s.check.action}\` | ${s.target} | ${verdict} |`;
  });
  return [
    '| Actor | State | Action | Target | Decision |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
};
