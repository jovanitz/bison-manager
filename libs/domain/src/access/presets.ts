import type { AccessPermission } from './permission';

/**
 * Administrative presets — NOT roles. The source of truth is always the
 * permission list stored per membership; a preset is just a starting bundle an
 * admin applies (and may then edit freely). Nothing in the policy ever asks
 * "is this actor an owner?" — it only ever checks permissions and grants.
 */
export type AccessPresetName = 'owner' | 'support' | 'customer';

const ownerAccessPreset: ReadonlyArray<AccessPermission> = [
  { action: 'account.disable', scope: 'any' },
  { action: 'permissions.update', scope: 'any' },
  { action: 'sessions.revoke', scope: 'any' },
  { action: 'audit.read', scope: 'any' },
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
];

const customerAccessPreset: ReadonlyArray<AccessPermission> = [
  { action: 'customer.read', scope: 'own' },
  { action: 'sessions.revoke', scope: 'own' },
];

const presets: Record<AccessPresetName, ReadonlyArray<AccessPermission>> = {
  owner: ownerAccessPreset,
  support: supportAccessPreset,
  customer: customerAccessPreset,
};

export const accessPresetPermissions = (
  name: AccessPresetName,
): ReadonlyArray<AccessPermission> => presets[name];
