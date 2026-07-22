import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useUseCases } from '../../../../di/use-cases-context';
import { createOrgDetailStore, type OrgDetailStore } from './org-detail-store';

/**
 * React binding for the org-detail store: builds it from the DI bundles (memoized
 * on their identities + the target accountId) and returns null until every
 * required bundle is wired — the ONLY place org-detail ties React to the headless
 * flow. Mirrors `dashboard/store/hooks.ts` (the Directory binding).
 */
export const useOrgDetailStore = (accountId: string): OrgDetailStore | null => {
  const { access, orgDetail, billing, members } = useUseCases();
  return useMemo(
    () =>
      access && orgDetail && billing && members
        ? createOrgDetailStore(
            { access, orgs: orgDetail, billing, members },
            accountId,
          )
        : null,
    [access, orgDetail, billing, members, accountId],
  );
};

export { useStore };
