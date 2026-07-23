import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useUseCases } from '../../../di/use-cases-context';
import { createDirectoryStore, type DirectoryStore } from './directory-store';
import { createPlansStore, type PlansStore } from './plans/plans-store';
import { createRolesStore, type RolesStore } from './roles/roles-store';
import {
  createTemplatesStore,
  type TemplatesStore,
} from './roles/templates-store';
import {
  createSettingsStore,
  type SettingsStore,
} from './settings/settings-store';
import {
  createStaffDetailStore,
  type StaffDetailStore,
} from './permissions/staff-detail-store';

/**
 * React binding for the Directory store: builds it from the DI bundles (memoized
 * on their stable identities) and returns null until every required bundle is
 * wired — the ONLY place the medicine-manager Directory ties React to the
 * headless flow. The component subscribes with a selector via `useStore`.
 */
export const useDirectoryStore = (): DirectoryStore | null => {
  const { access, directory, invitations, coverage, block, accounts } =
    useUseCases();
  return useMemo(
    () =>
      access && directory && invitations && coverage && block && accounts
        ? createDirectoryStore({
            access,
            directory,
            invitations,
            billing: coverage,
            block,
            accounts,
          })
        : null,
    [access, directory, invitations, coverage, block, accounts],
  );
};

/**
 * React binding for the Plans store: built from the DI bundles it needs (access
 * for the `plans.manage` gate + the billing gateway). Null until both are wired.
 */
export const usePlansStore = (): PlansStore | null => {
  const { access, billing } = useUseCases();
  return useMemo(
    () => (access && billing ? createPlansStore({ access, billing }) : null),
    [access, billing],
  );
};

/** React binding for the Roles store (access gate + the roles gateway). */
export const useRolesStore = (): RolesStore | null => {
  const { access, roles } = useUseCases();
  return useMemo(
    () => (access && roles ? createRolesStore({ access, roles }) : null),
    [access, roles],
  );
};

/** React binding for the Templates store (shares the same roles gateway). */
export const useTemplatesStore = (): TemplatesStore | null => {
  const { access, roles } = useUseCases();
  return useMemo(
    () => (access && roles ? createTemplatesStore({ access, roles }) : null),
    [access, roles],
  );
};

/** React binding for the Settings store (access gate + the settings gateway). */
export const useSettingsStore = (): SettingsStore | null => {
  const { access, settings } = useUseCases();
  return useMemo(
    () =>
      access && settings ? createSettingsStore({ access, settings }) : null,
    [access, settings],
  );
};

/** React binding for one staff member's access detail (keyed by identity). */
export const useStaffDetailStore = (
  userId: string,
  accountId: string,
): StaffDetailStore | null => {
  const { access, members, roles, sessions } = useUseCases();
  return useMemo(
    () =>
      access && members && roles && sessions
        ? createStaffDetailStore(
            { access, members, roles, sessions },
            userId,
            accountId,
          )
        : null,
    [access, members, roles, sessions, userId, accountId],
  );
};

export { useStore };
