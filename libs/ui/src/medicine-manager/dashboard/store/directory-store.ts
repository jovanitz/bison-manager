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
    action: 'disable' | 'enable' | 'promote' | 'demote',
    accountId: string,
  ) => Promise<void>;
  /**
   * The one-time activation token, or why it failed. Discriminated on purpose:
   * a bare `string` cannot tell a token from an error message, and the caller
   * would happily put an error into someone's clipboard.
   */
  readonly invite: (email: string) => Promise<TokenResult>;
  readonly regenerate: (invitationId: string) => Promise<TokenResult>;
  /** Withdraw a pending invitation; its link stops activating. */
  readonly revoke: (invitationId: string) => Promise<void>;
  /**
   * Email the invitee a fresh link. Returns the failure message (there is no
   * token to hand back — the point is that the MAIL carries it), so the caller
   * can tell "sent" from "the mail provider is down" instead of guessing.
   */
  readonly resend: (invitationId: string) => Promise<string | null>;
  /** Erase an orphan identity. Irreversible; the server re-verifies orphanhood. */
  readonly purgeOrphan: (userId: string) => Promise<void>;
};

export type TokenResult =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly message: string };

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
        if (!result.ok) return { ok: false, message: result.error.message };
        await reload();
        return { ok: true, token: result.value.token };
      },
      // Rotating changes the expiry, so the list must reload — otherwise the
      // row keeps showing the OLD expiry after a successful regenerate.
      regenerate: async (invitationId) => {
        const result = await deps.invitations.regenerate(invitationId);
        if (!result.ok) return { ok: false, message: result.error.message };
        await reload();
        return { ok: true, token: result.value.token };
      },
      revoke: async (invitationId) => {
        const result = await deps.invitations.revoke(invitationId);
        if (result.ok) await reload();
        else set({ error: result.error.message });
      },
      // The resend ROTATES the token server-side (new expiry), so reload.
      resend: async (invitationId) => {
        const result = await deps.invitations.resend(invitationId);
        if (!result.ok) return result.error.message;
        await reload();
        return null;
      },
      purgeOrphan: async (userId) => {
        const result = await deps.directory.purgeOrphan(userId);
        if (result.ok) await reload();
        else set({ error: result.error.message });
      },
    };
  });

export type DirectoryStore = ReturnType<typeof createDirectoryStore>;
