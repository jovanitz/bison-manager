/**
 * Fixture ViewModels for the navigable dashboard prototype. Data only — the
 * prototype feeds these to the pure section views. Reuses the section fixtures
 * where they exist; inlines the rest.
 */
import type {
  MemberRow,
  PermissionsVM,
  SessionRow,
} from '../permissions/permissions.types';
import type { RolesVM } from '../roles/roles.view';
import type { TemplatesVM } from '../roles/templates.view';
import type { AuditVM } from '../audit/audit.view';
import type { InviteVM } from '../invite/invite.view';
import type { SettingsVM } from '../settings/settings.view';

import {
  populatedVM as orgDetailVM,
  trialExpiredVM,
  suspendedVM,
  dormantVM,
  withImpersonationVM,
} from '../org-detail/org-detail.fixtures';
import type { OrgSubscriptionVM } from '../org-detail/org-detail.types';

export { populatedVM as directoryVM } from '../directory/directory.fixtures';
export { plansVM } from '../plans/plans.fixtures';
export { changePlanOptions } from '../org-detail/org-detail.fixtures';
export { orgDetailVM };

/** Each directory org opens a distinct billing scenario in its detail — so the
 *  navigable prototype shows every phase by clicking a different account. */
export const orgSubscriptions: Record<string, OrgSubscriptionVM | undefined> = {
  org_11: orgDetailVM.subscription, // active
  org_12: trialExpiredVM.subscription, // grace
  org_13: dormantVM.subscription, // dormant
  org_14: withImpersonationVM.subscription, // trialing
  org_15: suspendedVM.subscription, // suspended
};

const members: readonly MemberRow[] = [
  {
    membershipId: 'm1',
    userId: 'u1',
    displayName: 'Ana Torres',
    email: 'ana@acme.com',
    permissions: ['staff.read:any', 'roles.manage:own'],
    roleIds: ['r1'],
    blocked: false,
  },
  {
    membershipId: 'm2',
    userId: 'u2',
    displayName: 'Beto Ruiz',
    email: 'beto@acme.com',
    permissions: ['home.read:own'],
    roleIds: [],
    blocked: true,
  },
  {
    membershipId: 'm3',
    userId: 'u3',
    displayName: 'Cami Díaz',
    email: 'cami@acme.com',
    permissions: ['staff.read:own'],
    roleIds: ['r2'],
    blocked: false,
  },
];

export const permissionsSessions: readonly SessionRow[] = [
  { id: 'sess_abc123', createdAt: '2026-07-01 18:00' },
  { id: 'sess_def456', createdAt: '2026-06-28 09:12' },
];

export const permissionsVM: PermissionsVM = {
  members,
  availableRoles: [
    { id: 'r1', name: 'Owner' },
    { id: 'r2', name: 'Support' },
    { id: 'r3', name: 'Auditor' },
  ],
  canEdit: true,
  canBlock: true,
  canReadSessions: true,
};

export const rolesVM: RolesVM = {
  canManage: true,
  roles: [
    {
      id: 'r1',
      name: 'Owner',
      scopeLabel: 'platform',
      permissions: ['*:any'],
      isDefault: true,
      synced: true,
    },
    {
      id: 'r2',
      name: 'Support',
      scopeLabel: 'org_11',
      permissions: ['staff.read:any', 'account.read:own'],
      isDefault: false,
      synced: false,
    },
  ],
};

export const templatesVM: TemplatesVM = {
  canManage: true,
  templates: [
    { key: 'owner', name: 'Owner', scope: 'own', permissions: ['*:own'] },
    {
      key: 'admin',
      name: 'Admin',
      scope: 'own',
      permissions: ['members.read:own', 'members.invite:own'],
    },
    {
      key: 'member',
      name: 'Member',
      scope: 'own',
      permissions: ['home.read:own'],
    },
  ],
};

export const auditVM: AuditVM = {
  entries: [
    {
      id: '1',
      type: 'org.deletion_scheduled',
      category: 'access',
      actor: 'Ana Torres',
      target: { label: 'Óptica Vista', kind: 'org', id: 'org_16' },
      occurredAt: '2026-07-13 18:04',
    },
    {
      id: '2',
      type: 'payment.voided',
      category: 'billing',
      actor: 'Ana Torres',
      target: { label: 'Salud Total', kind: 'org', id: 'org_15' },
      occurredAt: '2026-07-13 12:20',
    },
    {
      id: '3',
      type: 'org.blocked',
      category: 'access',
      target: { label: 'Hospital Río', kind: 'org', id: 'org_13' },
      occurredAt: '2026-07-11 16:30',
    },
    {
      id: '4',
      type: 'invite.sent',
      category: 'invites',
      actor: 'ana@acme.com',
      target: { label: 'nuevo@norte.mx', kind: 'identity' },
      occurredAt: '2026-07-09 15:10',
    },
    {
      id: '5',
      type: 'role.assigned',
      category: 'roles',
      actor: 'Beto Ruiz',
      target: { label: 'Ana Torres', kind: 'staff', id: 'acc_01' },
      occurredAt: '2026-07-08 17:52',
    },
    {
      id: '6',
      type: 'session.revoked',
      category: 'sessions',
      actor: 'Ana Torres',
      target: { label: 'Ana Torres', kind: 'staff', id: 'acc_01' },
      occurredAt: '2026-07-08 08:12',
    },
  ],
};

export const inviteVM: InviteVM = { busy: false };

export const settingsVM: SettingsVM = {
  policy: {
    customerIdle: 900000,
    customerMax: 28800000,
    staffIdle: 1800000,
    staffMax: 43200000,
  },
};
