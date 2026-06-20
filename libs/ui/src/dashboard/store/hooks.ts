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
  const { access, directory, block, invitations } = useUseCases();
  return useMemo(
    () =>
      access && directory && block && invitations
        ? createDashboardStore({ access, directory, block, invitations })
        : null,
    [access, directory, block, invitations],
  );
};

export const useStaffMembersStore = (): StaffMembersStore | null => {
  const { access, members, block } = useUseCases();
  return useMemo(
    () =>
      access && members && block
        ? createStaffMembersStore({ access, members, block })
        : null,
    [access, members, block],
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

export { useStore };
