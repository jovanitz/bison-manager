import {
  ACCESS_ACTIONS,
  ACCESS_AUDIT_EVENT_TYPES,
  ACCESS_CUSTOMER_DELEGABLE_ACTIONS,
  ACCESS_GRANT_REASON_MAX,
  ACCESS_INVITATION_TTL_DAYS,
  ACCESS_SESSION_IDLE_MIN_MS,
  ACCESS_SESSION_LIFETIME_MAX_MS,
  ACCESS_SESSION_MAX_CONCURRENT,
  ACCESS_SESSION_POLICY_DEFAULTS,
  ACCESS_SESSION_PURGE_AFTER_DAYS,
  ACCESS_SESSION_SLIDE_THRESHOLD_MS,
  IMPERSONATION_GRANT_ACTIONS,
  IMPERSONATION_GRANT_DEFAULT_MINUTES,
  IMPERSONATION_GRANT_MAX_MINUTES,
  accessPresetPermissions,
} from '@acme/domain';
import type {
  AccessAction,
  AccessAuditEventType,
  AccessPresetName,
} from '@acme/domain';
import type { ApiProcedure } from '../../../apps/api/src/rpc/procedure';

/**
 * Human descriptions keyed by the code's own unions. Exhaustive Records:
 * adding an action or audit event without describing it here is a compile
 * error — the generator (and therefore the gate) refuses to run.
 */
const ACTION_DESCRIPTIONS: Record<AccessAction, string> = {
  'account.disable': 'Disable an account (blocks login, refresh and actions)',
  'account.enable':
    'Re-enable a disabled account (the undo; unexpired sessions resume)',
  'account.promote':
    'Promote a customer account to staff (strict sessions, not impersonable)',
  'permissions.update': 'Replace the persistent permissions of a membership',
  'sessions.revoke': 'Revoke a session immediately (kills refresh tokens too)',
  'sessions.read':
    "List a membership's sessions with device/IP context (active-sessions view)",
  'staff.read': 'List the staff (platform-internal) directory',
  'access.block':
    'Soft-block / unblock an org or identity (can sign in, cannot operate)',
  'customer.search': 'Search the customer directory',
  'customer.read': 'Read a customer account',
  'impersonation.start': 'Open a view-only impersonation grant on a customer',
  'impersonation.end': 'End an impersonation grant (holder only)',
  'audit.read': 'Read the audit trail',
  'settings.update':
    'Reconfigure the session lifetime policy (within hard bounds)',
  'members.invite':
    'Invite an email into an existing account with explicit permissions',
  'members.read': "List an account's memberships with their permissions",
  'members.remove':
    'Remove a membership from its account (sessions die with it)',
  'members.block':
    'Soft-block one member inside your own org (own scope): they can sign in but cannot operate',
};

const AUDIT_EVENT_DESCRIPTIONS: Record<AccessAuditEventType, string> = {
  'login.succeeded': 'A verified identity registered a session',
  'login.failed':
    'A password check failed (reported by the auth provider hook)',
  'account.disabled': 'An account was disabled, by whom and why',
  'account.enabled': 'A disabled account was re-enabled, by whom',
  'account.promoted': 'A customer account became staff, by whom',
  'permissions.updated': 'Permissions replaced (records before and after)',
  'member.roles-assigned':
    "A membership's role assignment was replaced (records the new role set)",
  'session.revoked': 'A session was revoked, by whom',
  'impersonation.started': 'Support opened a view-only grant (with reason)',
  'impersonation.ended': 'The grant holder ended an impersonation',
  'grant.expired': 'An expired grant was recorded (lazy or pg_cron)',
  'settings.updated':
    'The session policy was reconfigured (records before and after)',
  'owner.bootstrapped': 'The one-time env-driven owner promotion ran',
  'invitation.created':
    'An email was invited into an account (with which permissions, by whom)',
  'invitation.accepted':
    'The invited identity logged in and joined the account',
  'member.removed':
    'A membership was removed from its account, by whom (sessions included)',
  'session.switched':
    'A user re-bound their session to another of their own memberships',
  'access.blocked':
    'An org or identity was soft-blocked (can sign in, cannot operate)',
  'access.unblocked': 'A soft block on an org or identity was lifted',
};

const PRESETS: ReadonlyArray<AccessPresetName> = [
  'owner',
  'support',
  'customer',
  'customer-admin',
];

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

const human = (ms: number): string => {
  if (ms % DAY_MS === 0) return `${ms / DAY_MS} d`;
  if (ms % HOUR_MS === 0) return `${ms / HOUR_MS} h`;
  return `${ms / MIN_MS} min`;
};

export const renderDurations = (jwtExpirySeconds: number): string => {
  const policy = ACCESS_SESSION_POLICY_DEFAULTS;
  return [
    'Sessions run on **two clocks — whichever ends first wins**: an idle',
    'window that *slides forward on every authenticated request*, and an',
    'absolute lifetime anchored at login that never slides. Defaults below',
    'are **runtime-editable** via `settings.update` (within the hard bounds);',
    'tightening shrinks every live session immediately, loosening is only',
    'gained through later activity.',
    '',
    '| Rule | Value | Source of truth |',
    '| --- | --- | --- |',
    `| Access token (identity proof only — never authorizes) | ${jwtExpirySeconds / 60} min | \`supabase/config.toml\` → \`jwt_expiry\` |`,
    `| Customer session — idle (sliding) | ${human(policy.customer.idleTtlMs)} | \`ACCESS_SESSION_POLICY_DEFAULTS.customer\` |`,
    `| Customer session — absolute max | ${human(policy.customer.maxLifetimeMs)} | \`ACCESS_SESSION_POLICY_DEFAULTS.customer\` |`,
    `| Staff session — idle (sliding) | ${human(policy.staff.idleTtlMs)} | \`ACCESS_SESSION_POLICY_DEFAULTS.staff\` |`,
    `| Staff session — absolute max | ${human(policy.staff.maxLifetimeMs)} | \`ACCESS_SESSION_POLICY_DEFAULTS.staff\` |`,
    `| Policy hard bounds (runtime edits) | idle ≥ ${human(ACCESS_SESSION_IDLE_MIN_MS)} · max ≤ ${human(ACCESS_SESSION_LIFETIME_MAX_MS)} · staff ≤ customer | \`makeAccessSessionPolicies\` |`,
    `| Slide write threshold | ${human(ACCESS_SESSION_SLIDE_THRESHOLD_MS)} | \`ACCESS_SESSION_SLIDE_THRESHOLD_MS\` |`,
    `| Concurrent sessions per membership | ${ACCESS_SESSION_MAX_CONCURRENT} (oldest is revoked, audited) | \`ACCESS_SESSION_MAX_CONCURRENT\` |`,
    `| Dead-session purge | after ${ACCESS_SESSION_PURGE_AFTER_DAYS} d (audit events remain) | \`ACCESS_SESSION_PURGE_AFTER_DAYS\` + pg_cron |`,
    `| Impersonation grant — default | ${IMPERSONATION_GRANT_DEFAULT_MINUTES} min | \`IMPERSONATION_GRANT_DEFAULT_MINUTES\` |`,
    `| Impersonation grant — maximum | ${IMPERSONATION_GRANT_MAX_MINUTES} min | \`IMPERSONATION_GRANT_MAX_MINUTES\` |`,
    `| Grant reason | mandatory, ≤ ${ACCESS_GRANT_REASON_MAX} chars | \`ACCESS_GRANT_REASON_MAX\` |`,
    `| Invitation expiry | ${ACCESS_INVITATION_TTL_DAYS} d (pending, unaccepted) | \`ACCESS_INVITATION_TTL_DAYS\` |`,
  ].join('\n');
};

export const renderPresetMatrix = (): string => {
  const presetPermissions = new Map(
    PRESETS.map((name) => [
      name,
      new Map(
        accessPresetPermissions(name).map((p) => [p.action, p.scope] as const),
      ),
    ]),
  );
  const scopeLabel = (preset: AccessPresetName, action: AccessAction) => {
    const scope = presetPermissions.get(preset)?.get(action);
    if (!scope) return '—';
    return scope === 'any' ? '✅ any account' : '✅ own account';
  };
  const rows = ACCESS_ACTIONS.map(
    (action) =>
      `| \`${action}\` | ${ACTION_DESCRIPTIONS[action]} | ${PRESETS.map((p) =>
        scopeLabel(p, action),
      ).join(' | ')} |`,
  );
  return [
    `| Action | Meaning | ${PRESETS.join(' | ')} |`,
    `| --- | --- | ${PRESETS.map(() => '---').join(' | ')} |`,
    ...rows,
  ].join('\n');
};

export const renderDelegableActions = (): string =>
  [
    'Customer organizations (kind `customer`) may only ever hold this subset',
    'of actions — `permissions.update` and `members.invite` refuse anything',
    'else (`app/not-delegable-to-customer`), **even from the owner** and even',
    'with `own` scope. `any` scope additionally requires a staff account',
    '(`app/requires-staff-account`). Everything outside the list (disabling',
    'accounts, promoting, impersonation, session policy, the directory) is',
    'platform-staff machinery.',
    '',
    ACCESS_CUSTOMER_DELEGABLE_ACTIONS.map((a) => `\`${a}\``).join(' · '),
    '',
    '**Anti-orphan rule:** every account always keeps at least one membership',
    'holding `permissions.update` (the root-equivalent capability). A',
    '`permissions.update` that would demote the last administrator, or a',
    '`members.remove` of the last administrator, is refused',
    '(`app/cannot-orphan-account`) — an account can never be left ungovernable',
    'from within (the platform owner stays the only external fix).',
  ].join('\n');

export const renderImpersonationRules = (): string =>
  [
    `- Grants are an **allowlist**: impersonation authorizes exactly ${IMPERSONATION_GRANT_ACTIONS.map(
      (a) => `\`${a}\``,
    ).join(', ')} — nothing else, on **one** target account.`,
    '- A reason is **mandatory** (audited verbatim).',
    `- Duration: ${IMPERSONATION_GRANT_DEFAULT_MINUTES} min by default, hard cap ${IMPERSONATION_GRANT_MAX_MINUTES} min.`,
    '- The actor **always remains the support agent** — no token is ever minted as the customer; the audit records who looked at what and why.',
    '- Only the grant holder can end it early; expiry ends it automatically.',
    '- Note: `support` deliberately lacks `customer.read` as a permission — reading customer data is only ever reachable through an active grant.',
  ].join('\n');

export const renderAuditEvents = (): string =>
  [
    '| Event | Meaning |',
    '| --- | --- |',
    ...ACCESS_AUDIT_EVENT_TYPES.map(
      (t) => `| \`${t}\` | ${AUDIT_EVENT_DESCRIPTIONS[t]} |`,
    ),
  ].join('\n');

export const renderProcedures = (
  procedures: ReadonlyArray<ApiProcedure>,
): string =>
  [
    '| Procedure (`POST /rpc/<name>`) | Required action | Summary |',
    '| --- | --- | --- |',
    ...procedures.map(
      (p) =>
        `| \`${p.name}\` | ${p.action ? `\`${p.action}\`` : '— (any authenticated actor)'} | ${p.summary} |`,
    ),
  ].join('\n');
