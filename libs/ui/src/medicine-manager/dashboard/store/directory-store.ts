import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type AccountAdminGateway,
  type BlockUseCases,
  type CoverageReader,
  type DirectoryUseCases,
  type InvitationsUseCases,
  adminAccount,
  inviteStaffToOwnAccount,
  loadDirectory,
  setSubjectBlocked,
} from '@acme/application';
import type { DirectoryVM } from '../directory/directory.columns';
import { toDirectoryVM } from './directory-vm';

/**
 * Reactive store for the medicine-manager Directory (ADR-0017 giro-owned). Thin:
 * `load` runs the headless `loadDirectory` flow and maps it to the VM; the
 * dispatchers call the dashboard command controllers and reload. Navigation
 * (open org / staff) and the not-yet-backed actions (demote, deletion, export,
 * void/refund) stay with the section, not the store.
 */
export type DirectoryStoreState = {
  readonly vm: DirectoryVM | null;
  readonly error: string | null;
  readonly load: () => Promise<void>;
  readonly block: (
    subject: 'org' | 'identity',
    id: string,
    blocked: boolean,
  ) => Promise<void>;
  readonly admin: (
    action: 'disable' | 'enable' | 'promote',
    accountId: string,
  ) => Promise<void>;
  /** Returns the fresh activation token, or the error message. */
  readonly invite: (email: string) => Promise<string>;
  readonly regenerate: (invitationId: string) => Promise<string>;
};

export type DirectoryStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
  readonly invitations: InvitationsUseCases;
  readonly billing: CoverageReader;
  readonly block: BlockUseCases;
  readonly accounts: AccountAdminGateway;
};

export const createDirectoryStore = (deps: DirectoryStoreDeps) =>
  createStore<DirectoryStoreState>((set) => {
    const reload = async () => {
      const result = await loadDirectory(deps);
      set(
        result.ok
          ? { vm: toDirectoryVM(result.value, new Date().toISOString()) }
          : { error: result.error.message },
      );
    };
    return {
      vm: null,
      error: null,
      load: reload,
      block: async (subject, id, blocked) => {
        const result = await setSubjectBlocked(deps, { subject, id, blocked });
        if (result.ok) await reload();
      },
      admin: async (action, accountId) => {
        const result = await adminAccount(deps, { action, accountId });
        if (result.ok) await reload();
      },
      invite: async (email) => {
        const result = await inviteStaffToOwnAccount(deps, { email });
        if (!result.ok) return result.error.message;
        await reload();
        return result.value.token;
      },
      regenerate: async (invitationId) => {
        const result = await deps.invitations.regenerate(invitationId);
        return result.ok ? result.value.token : result.error.message;
      },
    };
  });

export type DirectoryStore = ReturnType<typeof createDirectoryStore>;
