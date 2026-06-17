import { useEffect } from 'react';
import { useOrgAdminStore, useStore } from '../store/hooks';
import type { OrgAdminStore } from '../store/org-admin-store';
import { InviteMember } from './invite-member';
import { MemberList } from './member-list';

/**
 * The org admin's control panel. Pure presentation: it reads the ViewModel from
 * the org-admin store and dispatches actions. Every decision (capabilities,
 * permission-set mutation, default grant) lives in the headless controller.
 */
const ManageOrgView = ({ store }: { readonly store: OrgAdminStore }) => {
  const vm = useStore(store, (s) => s.vm);
  const notice = useStore(store, (s) => s.notice);
  const inviteToken = useStore(store, (s) => s.inviteToken);

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  if (!vm || vm.hidden) return null;

  return (
    <section aria-label="manage organization">
      <h2>Manage your organization</h2>
      {vm.canInvite ? (
        <InviteMember
          token={inviteToken}
          onInvite={(email) => void store.getState().invite(email)}
        />
      ) : null}
      <MemberList
        members={vm.members}
        caps={{
          canEdit: vm.canEdit,
          canRemove: vm.canRemove,
          canBlock: vm.canBlock,
        }}
        handlers={{
          onAdd: (id, action) =>
            void store.getState().grant({ membershipId: id, action }),
          onRemove: (id) => void store.getState().remove(id),
          onBlock: (id, blocked) =>
            void store.getState().setBlocked(id, blocked),
        }}
        notice={notice ?? undefined}
      />
    </section>
  );
};

export const ManageOrgSection = () => {
  const store = useOrgAdminStore();
  if (!store) return null;
  return <ManageOrgView store={store} />;
};
