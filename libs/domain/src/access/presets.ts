import type { AccessPermission } from './permission';
import type { AccessAction } from './value-objects';

/**
 * Administrative presets — NOT roles. The source of truth is always the
 * permission list stored per membership; a preset is just a starting bundle an
 * admin applies (and may then edit freely). Nothing in the policy ever asks
 * "is this actor an owner?" — it only ever checks permissions and grants.
 *
 * ADR-0017: these are the EXISTING giro's presets — a new giro defines its
 * own (injectable via `AccessConfig`, ADR-0015), never extends these.
 */
export type AccessPresetName =
  | 'owner'
  | 'support'
  | 'customer'
  | 'customer-admin';

const ownerAccessPreset: ReadonlyArray<AccessPermission> = [
  { action: 'account.disable', scope: 'any' },
  { action: 'account.enable', scope: 'any' },
  { action: 'account.promote', scope: 'any' },
  { action: 'permissions.update', scope: 'any' },
  { action: 'sessions.revoke', scope: 'any' },
  { action: 'sessions.read', scope: 'any' },
  { action: 'staff.read', scope: 'any' },
  { action: 'customer.search', scope: 'any' },
  { action: 'access.block', scope: 'any' },
  { action: 'audit.read', scope: 'any' },
  { action: 'settings.update', scope: 'any' },
  { action: 'members.invite', scope: 'any' },
  { action: 'members.read', scope: 'any' },
  { action: 'members.remove', scope: 'any' },
  // ADR-0016: administering the plan catalog is owner-only in v1.
  { action: 'plans.manage', scope: 'any' },
  { action: 'billing.read', scope: 'any' },
];

/**
 * Support can find customers and open a view-only impersonation. Note what is
 * missing: `customer.read`. Reading a customer's data is only ever authorized
 * by an active impersonation grant on that specific account.
 */
const supportAccessPreset: ReadonlyArray<AccessPermission> = [
  { action: 'customer.search', scope: 'any' },
  { action: 'impersonation.start', scope: 'any' },
  { action: 'impersonation.end', scope: 'any' },
  // ADR-0016: support may read any org's billing, never manage the catalog.
  { action: 'billing.read', scope: 'any' },
];

const customerAccessPreset: ReadonlyArray<AccessPermission> = [
  { action: 'customer.read', scope: 'own' },
  { action: 'sessions.revoke', scope: 'own' },
  { action: 'sessions.read', scope: 'own' },
];

/**
 * Organization admin: manages the members of their OWN account — invite,
 * list, remove, edit permissions, kill sessions, read their audit slice.
 * Strictly a subset of the delegable actions; never platform machinery.
 */
const customerAdminAccessPreset: ReadonlyArray<AccessPermission> = [
  ...customerAccessPreset,
  { action: 'members.invite', scope: 'own' },
  { action: 'members.read', scope: 'own' },
  { action: 'members.remove', scope: 'own' },
  { action: 'members.block', scope: 'own' },
  { action: 'permissions.update', scope: 'own' },
  { action: 'audit.read', scope: 'own' },
  // ADR-0016: an org admin reads their own org's billing/subscription state.
  { action: 'billing.read', scope: 'own' },
];

const presets: Record<AccessPresetName, ReadonlyArray<AccessPermission>> = {
  owner: ownerAccessPreset,
  support: supportAccessPreset,
  customer: customerAccessPreset,
  'customer-admin': customerAdminAccessPreset,
};

export const accessPresetPermissions = (
  name: AccessPresetName,
): ReadonlyArray<AccessPermission> => presets[name];

/**
 * The actions a CUSTOMER-kind membership may hold at all. Everything outside
 * this list is platform-staff machinery (disabling accounts, promoting,
 * impersonating, reconfiguring session policy, browsing the directory) and
 * must never be delegable into an organization — not even with `own` scope,
 * and not even by the owner. Together with the staff-account rule for `any`
 * scope this bounds the blast radius of an organization admin to managing
 * their own members.
 */
export const ACCESS_CUSTOMER_DELEGABLE_ACTIONS = [
  'customer.read',
  'sessions.revoke',
  'sessions.read',
  'members.invite',
  'members.read',
  'members.remove',
  'members.block',
  'permissions.update',
  'audit.read',
  // ADR-0016: customers may delegate reading their own billing. `plans.manage`
  // is deliberately absent — the catalog is staff machinery, never delegable.
  'billing.read',
] as const satisfies ReadonlyArray<AccessAction>;

export const isCustomerDelegableAction = (action: AccessAction): boolean =>
  (ACCESS_CUSTOMER_DELEGABLE_ACTIONS as ReadonlyArray<AccessAction>).includes(
    action,
  );
