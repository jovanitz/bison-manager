import type {
  RoleSummaryDto,
  RoleTemplateDto,
  RolesViewModel,
  TemplatesViewModel,
} from '@acme/application';
import type {
  Permission,
  RoleDraft,
  RoleRow,
  RolesVM,
  TemplateDraft,
  TemplateRow,
  TemplatesVM,
} from '../../roles/roles.types';

/**
 * Pure mappers between the application roles/templates DTOs and the UI VMs
 * (ADR-0011/0013). Honest to the contract: a role has no scope of its own —
 * `isDefault` is derived from `templateKey`, `synced` from `templateSynced`;
 * a template's `scope` is narrowed to the UI's 'platform' | 'org'.
 */

const toPerms = (
  p: ReadonlyArray<{ readonly action: string; readonly scope: string }>,
): readonly Permission[] =>
  p.map((x) => ({ action: x.action, scope: x.scope }));

export const toRoleRow = (dto: RoleSummaryDto): RoleRow => ({
  id: dto.id,
  name: dto.name,
  permissions: toPerms(dto.permissions),
  isDefault: dto.templateKey !== null,
  synced: dto.templateSynced,
});

export const toRolesVM = (rm: RolesViewModel): RolesVM => ({
  roles: rm.roles.map(toRoleRow),
  canManage: rm.canManage,
  loading: false,
});

export const toTemplateRow = (dto: RoleTemplateDto): TemplateRow => ({
  key: dto.key,
  name: dto.name,
  scope: dto.scope === 'platform' ? 'platform' : 'org',
  permissions: toPerms(dto.permissions),
});

export const toTemplatesVM = (rm: TemplatesViewModel): TemplatesVM => ({
  templates: rm.templates.map(toTemplateRow),
  canManage: rm.canManage,
  loading: false,
});

/** A blank role draft — what "Create role" opens with (one empty permission). */
export const blankRole: RoleDraft = {
  name: '',
  permissions: [{ action: '', scope: 'any' }],
};

/** Seed an edit draft from a row (pure — the stores reuse these). */
export const draftFromRoleRow = (r: RoleRow): RoleDraft => ({
  name: r.name,
  permissions: r.permissions,
});

export const draftFromTemplateRow = (t: TemplateRow): TemplateDraft => ({
  name: t.name,
  permissions: t.permissions,
});
