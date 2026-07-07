import { ok } from '@acme/shared';
import {
  accountIdInput,
  assignRolesInput,
  blockInput,
  createRoleInput,
  deleteRoleInput,
  empty,
  grantInput,
  inviteInput,
  resetTemplateInput,
  updateRoleInput,
  updateTemplateInput,
} from './registry-inputs';
import type { FlowCommand } from '../registry-types';
import { findFlowCommand } from '../registry-types';
import { ADMIN_FLOWS, type DashboardFlowDeps } from './flow-catalog';
import { BILLING_FLOWS } from './plans/billing-flows';
import { loadDashboard, loadStaffMembers, resolveAdminGate } from './queries';
import { loadOrgDetail } from './org-detail/org-detail';
import {
  grantStaffPermission,
  inviteStaff,
  setSubjectBlocked,
} from './commands';
import {
  applyTemplateToAll,
  assignMemberRoles,
  createPlatformRole,
  deletePlatformRole,
  loadDefaultTemplates,
  loadPlatformRoles,
  resetDefaultTemplate,
  resetPlatformRole,
  updateDefaultTemplate,
  updatePlatformRole,
} from './roles';

export type { DashboardFlowDeps } from './flow-catalog';

export const DASHBOARD_FLOWS: ReadonlyArray<FlowCommand<DashboardFlowDeps>> = [
  {
    name: 'admin.gate',
    kind: 'query',
    description:
      'Resolve the admin gate: anonymous | forbidden | blocked | authorized.',
    input: empty,
    run: async (deps) => ok(await resolveAdminGate(deps)),
  },
  {
    name: 'dashboard.load',
    kind: 'query',
    description: 'Load the staff + customers tables and the block capability.',
    input: empty,
    run: (deps) => loadDashboard(deps),
  },
  {
    name: 'staff.members.load',
    kind: 'query',
    description: "Load the actor's account members for the permissions editor.",
    input: empty,
    run: (deps) => loadStaffMembers(deps),
  },
  {
    name: 'org.detail.load',
    kind: 'query',
    description:
      "Load a customer org's detail: admin summary + roster (members.read) + " +
      'capabilities. Administrative, not impersonation.',
    input: accountIdInput,
    run: (deps, input) => loadOrgDetail(deps, accountIdInput.parse(input)),
  },
  {
    name: 'staff.members.grant',
    kind: 'command',
    description: 'Grant a permission (any scope) to a member.',
    input: grantInput,
    run: (deps, input) => grantStaffPermission(deps, grantInput.parse(input)),
  },
  {
    name: 'staff.invite',
    kind: 'command',
    description:
      'Invite a staff member into an account with the fixed staff grant.',
    input: inviteInput,
    run: (deps, input) => inviteStaff(deps, inviteInput.parse(input)),
  },
  {
    name: 'access.setBlocked',
    kind: 'command',
    description: 'Soft-block or unblock an org account or a user identity.',
    input: blockInput,
    run: (deps, input) => setSubjectBlocked(deps, blockInput.parse(input)),
  },
  {
    name: 'roles.load',
    kind: 'query',
    description: 'Load the platform roles + whether the actor may manage them.',
    input: empty,
    run: (deps) => loadPlatformRoles(deps),
  },
  {
    name: 'roles.create',
    kind: 'command',
    description: 'Create a platform-wide role (a named permission bundle).',
    input: createRoleInput,
    run: (deps, input) =>
      createPlatformRole(deps, createRoleInput.parse(input)),
  },
  {
    name: 'roles.delete',
    kind: 'command',
    description:
      'Delete a role; the server refuses while it is still assigned.',
    input: deleteRoleInput,
    run: (deps, input) =>
      deletePlatformRole(deps, deleteRoleInput.parse(input)),
  },
  {
    name: 'roles.assign',
    kind: 'command',
    description: "Replace a membership's whole role assignment (roles-only).",
    input: assignRolesInput,
    run: (deps, input) =>
      assignMemberRoles(deps, assignRolesInput.parse(input)),
  },
  {
    name: 'roles.reset',
    kind: 'command',
    description: 'Reset a default role to its factory template (ADR-0012).',
    input: deleteRoleInput,
    run: (deps, input) => resetPlatformRole(deps, deleteRoleInput.parse(input)),
  },
  {
    name: 'roles.update',
    kind: 'command',
    description: "Edit a role's name + permissions in place (live to holders).",
    input: updateRoleInput,
    run: (deps, input) =>
      updatePlatformRole(deps, updateRoleInput.parse(input)),
  },
  {
    name: 'templates.load',
    kind: 'query',
    description:
      'Load the editable default-role templates + whether the actor may edit.',
    input: empty,
    run: (deps) => loadDefaultTemplates(deps),
  },
  {
    name: 'templates.update',
    kind: 'command',
    description: "Edit a default template's name + permissions (ADR-0013).",
    input: updateTemplateInput,
    run: (deps, input) =>
      updateDefaultTemplate(deps, updateTemplateInput.parse(input)),
  },
  {
    name: 'templates.reset',
    kind: 'command',
    description: 'Reset a default template to its code definition (ADR-0013).',
    input: resetTemplateInput,
    run: (deps, input) =>
      resetDefaultTemplate(deps, resetTemplateInput.parse(input)),
  },
  {
    name: 'templates.applyAll',
    kind: 'command',
    description:
      'Force every instance of a template back to it, forks included (ADR-0014).',
    input: resetTemplateInput,
    run: (deps, input) =>
      applyTemplateToAll(deps, resetTemplateInput.parse(input)),
  },
  ...ADMIN_FLOWS,
  ...BILLING_FLOWS,
];

export const findDashboardFlow = (name: string) =>
  findFlowCommand(DASHBOARD_FLOWS, name);
