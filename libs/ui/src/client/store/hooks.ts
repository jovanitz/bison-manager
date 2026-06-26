import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useUseCases } from '../../di/use-cases-context';
import { createOrgAdminStore, type OrgAdminStore } from './org-admin-store';
import { createOrgRolesStore, type OrgRolesStore } from './org-roles-store';
import { createSessionStore, type SessionStore } from './session-store';

/**
 * React bindings: build a per-feature store from the DI bundles (memoized on
 * the stable bundle identities, so the store is created once) and subscribe to
 * it with a selector. The store delegates to headless controllers — this hook
 * is the ONLY place the UI ties React to them. Returns null until the bundles
 * the feature needs are wired.
 */
export const useOrgAdminStore = (): OrgAdminStore | null => {
  const { access, members, invitations, roles } = useUseCases();
  return useMemo(
    () =>
      access && members && invitations && roles
        ? createOrgAdminStore({ access, members, invitations, roles })
        : null,
    [access, members, invitations, roles],
  );
};

export const useOrgRolesStore = (): OrgRolesStore | null => {
  const { access, roles } = useUseCases();
  return useMemo(
    () => (access && roles ? createOrgRolesStore({ access, roles }) : null),
    [access, roles],
  );
};

export const useSessionStore = (): SessionStore | null => {
  const { access, orgs } = useUseCases();
  return useMemo(
    () => (access && orgs ? createSessionStore({ access, orgs }) : null),
    [access, orgs],
  );
};

/** Re-export zustand's selector hook so components import it from one place. */
export { useStore };
