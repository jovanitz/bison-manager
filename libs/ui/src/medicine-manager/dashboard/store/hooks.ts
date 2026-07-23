import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useUseCases } from '../../../di/use-cases-context';
import { createDirectoryStore, type DirectoryStore } from './directory-store';
import { createPlansStore, type PlansStore } from './plans/plans-store';

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

export { useStore };
