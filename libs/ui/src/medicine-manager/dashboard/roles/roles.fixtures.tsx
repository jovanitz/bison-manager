import type {
  RoleDraft,
  RoleRow,
  RolesVM,
  TemplateDraft,
  TemplateRow,
  TemplatesVM,
} from './roles.types';

/**
 * Fixtures for the Roles + Templates prototype — HONEST to the contract: these
 * are platform roles (no per-role scope; `isDefault` = from a factory template,
 * `synced=false` = forked), and templates carry a real 'platform' | 'org' scope.
 */

const roles: readonly RoleRow[] = [
  {
    id: 'r_owner',
    name: 'Owner',
    permissions: [{ action: '*', scope: 'any' }],
    isDefault: true,
    synced: true,
  },
  {
    id: 'r_support',
    name: 'Support',
    permissions: [
      { action: 'staff.read', scope: 'any' },
      { action: 'customers.read', scope: 'any' },
      { action: 'audit.read', scope: 'any' },
    ],
    isDefault: false,
    synced: true,
  },
  {
    id: 'r_auditor',
    name: 'Auditor',
    permissions: [{ action: 'audit.read', scope: 'any' }],
    isDefault: true,
    // A default that was edited away from its template.
    synced: false,
  },
];

export const rolesVM: RolesVM = { roles, canManage: true, loading: false };
export const rolesLoadingVM: RolesVM = {
  roles: [],
  canManage: true,
  loading: true,
};
export const rolesErrorVM: RolesVM = {
  roles: [],
  canManage: true,
  loading: false,
  error: 'Could not reach the access service.',
};
export const rolesEmptyVM: RolesVM = {
  roles: [],
  canManage: true,
  loading: false,
};
export const rolesReadOnlyVM: RolesVM = { ...rolesVM, canManage: false };

export const blankRole: RoleDraft = {
  name: '',
  permissions: [{ action: '', scope: 'any' }],
};
export const draftFromRole = (r: RoleRow): RoleDraft => ({
  name: r.name,
  permissions: r.permissions,
});

/** Create form open on a blank draft. */
export const createRoleVM: RolesVM = {
  ...rolesVM,
  form: { mode: 'create', roleId: null, draft: blankRole },
};
/** Edit form seeded from "Support" (multi-permission). */
export const editRoleVM: RolesVM = {
  ...rolesVM,
  form: {
    mode: 'edit',
    roleId: 'r_support',
    draft: draftFromRole(roles[1] as RoleRow),
  },
};
/** Deleting a custom role — warns the server refuses if still assigned. */
export const deleteRoleVM: RolesVM = {
  ...rolesVM,
  pendingDelete: { roleId: 'r_support', name: 'Support' },
};
/** Resetting a forked default back to its factory template. */
export const resetRoleVM: RolesVM = {
  ...rolesVM,
  pendingReset: { roleId: 'r_auditor', name: 'Auditor' },
};

// ── Templates ──────────────────────────────────────────────────────────────

const templates: readonly TemplateRow[] = [
  {
    key: 'org-owner',
    name: 'Owner',
    scope: 'org',
    permissions: [{ action: '*', scope: 'own' }],
  },
  {
    key: 'org-admin',
    name: 'Admin',
    scope: 'org',
    permissions: [
      { action: 'members.read', scope: 'own' },
      { action: 'members.invite', scope: 'own' },
      { action: 'roles.manage', scope: 'own' },
    ],
  },
  {
    key: 'org-member',
    name: 'Member',
    scope: 'org',
    permissions: [{ action: 'home.read', scope: 'own' }],
  },
  {
    key: 'staff-support',
    name: 'Support',
    scope: 'platform',
    permissions: [{ action: 'staff.read', scope: 'any' }],
  },
];

export const templatesVM: TemplatesVM = {
  templates,
  canManage: true,
  loading: false,
};
export const templatesLoadingVM: TemplatesVM = {
  templates: [],
  canManage: true,
  loading: true,
};
export const templatesReadOnlyVM: TemplatesVM = {
  ...templatesVM,
  canManage: false,
};

export const draftFromTemplate = (t: TemplateRow): TemplateDraft => ({
  name: t.name,
  permissions: t.permissions,
});

/** Edit the "Admin" template (name + permissions). */
export const editTemplateVM: TemplatesVM = {
  ...templatesVM,
  form: {
    key: 'org-admin',
    scope: 'org',
    draft: draftFromTemplate(templates[1] as TemplateRow),
  },
};
/** Reset the "Admin" template to its code definition. */
export const resetTemplateVM: TemplatesVM = {
  ...templatesVM,
  pendingReset: { key: 'org-admin', name: 'Admin' },
};
/** Apply "Admin" to every live instance — the mass, confirm-gated action. */
export const applyTemplateVM: TemplatesVM = {
  ...templatesVM,
  pendingApply: { key: 'org-admin', name: 'Admin' },
};
/** After an apply-to-all — the result count surfaced as an info notice. */
export const appliedNoticeVM: TemplatesVM = {
  ...templatesVM,
  notice: '“Admin” applied to 8 live roles.',
};
