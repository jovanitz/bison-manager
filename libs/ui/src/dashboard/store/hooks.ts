import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useUseCases } from '../../di/use-cases-context';
import { createAdminGateStore, type AdminGateStore } from './admin-gate-store';
import { createDashboardStore, type DashboardStore } from './dashboard-store';
import {
  createStaffMembersStore,
  type StaffMembersStore,
} from './staff-members-store';
import {
  createStaffInviteStore,
  type StaffInviteStore,
} from './staff-invite-store';
import { createRolesStore, type RolesStore } from './roles-store';
import { createTemplatesStore, type TemplatesStore } from './templates-store';
import { createAuditStore, type AuditStore } from './admin/audit-store';
import { createSettingsStore, type SettingsStore } from './admin/settings-store';

/**
 * React bindings for the dashboard stores: each builds its store from the DI
 * bundles (memoized on the stable identities) and the component subscribes with
 * a selector. The ONLY place the dashboard UI ties React to the headless
 * controllers. Each returns null until its required bundles are wired.
 */
export const useAdminGateStore = (): AdminGateStore | null => {
  const { access } = useUseCases();
  return useMemo(
    () => (access ? createAdminGateStore({ access }) : null),
    [access],
  );
};

export const useDashboardStore = (): DashboardStore | null => {
  const { access, directory, block, invitations, accounts } = useUseCases();
  return useMemo(
    () =>
      access && directory && block && invitations && accounts
        ? createDashboardStore({
            access,
            directory,
            block,
            invitations,
            accounts,
          })
        : null,
    [access, directory, block, invitations, accounts],
  );
};

export const useStaffMembersStore = (): StaffMembersStore | null => {
  const { access, members, block, roles, sessions } = useUseCases();
  return useMemo(
    () =>
      access && members && block && roles && sessions
        ? createStaffMembersStore({ access, members, block, roles, sessions })
        : null,
    [access, members, block, roles, sessions],
  );
};

export const useStaffInviteStore = (): StaffInviteStore | null => {
  const { access, invitations } = useUseCases();
  return useMemo(
    () =>
      access && invitations
        ? createStaffInviteStore({ access, invitations })
        : null,
    [access, invitations],
  );
};

export const useRolesStore = (): RolesStore | null => {
  const { access, roles } = useUseCases();
  return useMemo(
    () => (access && roles ? createRolesStore({ access, roles }) : null),
    [access, roles],
  );
};

export const useAuditStore = (): AuditStore | null => {
  const { access, audit } = useUseCases();
  return useMemo(
    () => (access && audit ? createAuditStore({ access, audit }) : null),
    [access, audit],
  );
};

export const useSettingsStore = (): SettingsStore | null => {
  const { access, settings } = useUseCases();
  return useMemo(
    () =>
      access && settings ? createSettingsStore({ access, settings }) : null,
    [access, settings],
  );
};

export const useTemplatesStore = (): TemplatesStore | null => {
  const { access, roles } = useUseCases();
  return useMemo(
    () => (access && roles ? createTemplatesStore({ access, roles }) : null),
    [access, roles],
  );
};

export { useStore };
