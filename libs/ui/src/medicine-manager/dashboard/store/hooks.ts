import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useUseCases } from '../../../di/use-cases-context';
import { createDirectoryStore, type DirectoryStore } from './directory-store';

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

export { useStore };
