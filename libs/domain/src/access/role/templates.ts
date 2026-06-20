import type { Result } from '@acme/shared';
import type { AccessPermission } from '../permission';
import type { AccessDomainError } from '../errors';
import { accessPresetPermissions } from '../presets';
import { createRole, type Role } from './role';

/** A factory template is platform-wide or per customer organization. */
export type RoleTemplateScope = 'platform' | 'org';

/**
 * A default role definition (ADR-0012). Pure, version-controlled data — the
 * immutable baseline a live role can be reset to. The only hardcoded roles
 * data, and it is data: changing it is a reviewed deploy. The ADR-0010 presets
 * live on here as templates (rather than being dropped).
 */
export type RoleTemplate = {
  readonly key: string;
  readonly name: string;
  readonly scope: RoleTemplateScope;
  readonly permissions: ReadonlyArray<AccessPermission>;
};

export const ROLE_TEMPLATES: ReadonlyArray<RoleTemplate> = [
  {
    key: 'support',
    name: 'Support',
    scope: 'platform',
    permissions: accessPresetPermissions('support'),
  },
  {
    key: 'admin',
    name: 'Admin',
    scope: 'org',
    permissions: accessPresetPermissions('customer-admin'),
  },
  {
    key: 'member',
    name: 'Member',
    scope: 'org',
    permissions: accessPresetPermissions('customer'),
  },
];

export const findRoleTemplate = (key: string): RoleTemplate | null =>
  ROLE_TEMPLATES.find((template) => template.key === key) ?? null;

export const roleTemplatesForScope = (
  scope: RoleTemplateScope,
): ReadonlyArray<RoleTemplate> =>
  ROLE_TEMPLATES.filter((template) => template.scope === scope);

/**
 * Reset a live role to its factory template (ADR-0012): restores the name and
 * permissions and re-stamps the template key, **keeping the same id and
 * account** so existing member assignments survive the reset.
 */
export const resetRoleFromTemplate = (
  role: Role,
  template: RoleTemplate,
): Result<Role, AccessDomainError> =>
  createRole({
    id: role.id,
    name: template.name,
    accountId: role.accountId,
    permissions: template.permissions,
    templateKey: template.key,
  });
