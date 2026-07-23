import { createStore } from 'zustand/vanilla';
import {
  type AccessClientUseCases,
  type MembersUseCases,
  type MemberSummaryDto,
  type RolesGateway,
  type SessionsGateway,
  loadAccountMembers,
} from '@acme/application';
import type { StaffDetailVM } from '../../permissions/permissions.view';
import { toMemberRow, toRoleOption, toSessionRow } from './permissions-vm';

/**
 * Reactive store for one staff member's access detail (ADR-0011, giro-owned).
 * `load` runs the headless `loadStaffMembers` flow (gated on `members.read`),
 * selects the member by identity (`userId` — the Directory→detail join key), and
 * enriches it with that member's sessions. Levers: assign roles (the audited
 * `member.roles-assigned`), grant a permission, revoke sessions — each reloads.
 * `canBlock` is false here: identity block lives in the Directory staff tab.
 */
export type StaffDetailStoreDeps = {
  readonly access: AccessClientUseCases;
  readonly members: MembersUseCases;
  readonly roles: RolesGateway;
  readonly sessions: SessionsGateway;
};

export type StaffDetailStoreState = {
  readonly vm: StaffDetailVM | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly load: () => Promise<void>;
  readonly assignRoles: (
    membershipId: string,
    roleIds: readonly string[],
  ) => Promise<void>;
  readonly grant: (
    membershipId: string,
    action: string,
    scope: string,
  ) => Promise<void>;
  readonly revokeSession: (sessionId: string) => Promise<void>;
  readonly revokeAll: (membershipId: string) => Promise<void>;
};

export const createStaffDetailStore = (
  deps: StaffDetailStoreDeps,
  userId: string,
  accountId: string,
) =>
  createStore<StaffDetailStoreState>((set) => {
    let raw: MemberSummaryDto | null = null;
    const loadSessions = async (membershipId: string) => {
      const s = await deps.sessions.list(membershipId);
      return s.ok ? s.value.map(toSessionRow) : [];
    };
    const reload = async () => {
      set({ loading: true, error: null });
      const r = await loadAccountMembers(
        {
          access: deps.access,
          members: deps.members,
          roles: deps.roles,
        },
        accountId,
      );
      if (!r.ok) return set({ loading: false, error: r.error.message });
      if (r.value.hidden)
        return set({ loading: false, error: 'You can’t view staff access.' });
      const member = r.value.members.find((m) => m.userId === userId);
      if (!member)
        return set({ loading: false, error: 'Staff member not found.' });
      raw = member;
      const sessions = r.value.canReadSessions
        ? await loadSessions(member.membershipId)
        : [];
      set({
        loading: false,
        error: null,
        vm: {
          member: toMemberRow(member),
          availableRoles: r.value.availableRoles.map(toRoleOption),
          sessions,
          canEdit: r.value.canEdit && !member.isRoot,
          canBlock: false,
          canReadSessions: r.value.canReadSessions,
        },
      });
    };
    const after = async (r: { readonly ok: boolean }) => {
      if (r.ok) await reload();
    };
    return {
      vm: null,
      loading: true,
      error: null,
      load: reload,
      assignRoles: async (membershipId, roleIds) =>
        after(await deps.roles.assignRoles({ membershipId, roleIds })),
      grant: async (membershipId, action, scope) => {
        if (!raw) return;
        await after(
          await deps.members.updatePermissions({
            membershipId,
            permissions: [...raw.permissions, { action, scope }],
          }),
        );
      },
      revokeSession: async (sessionId) =>
        after(await deps.sessions.revoke(sessionId)),
      revokeAll: async (membershipId) =>
        after(await deps.sessions.revokeAll(membershipId)),
    };
  });

export type StaffDetailStore = ReturnType<typeof createStaffDetailStore>;
