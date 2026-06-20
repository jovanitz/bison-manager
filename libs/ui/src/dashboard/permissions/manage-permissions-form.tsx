import { useEffect, useState } from 'react';
import { useStaffMembersStore, useStore } from '../store/hooks';
import type { StaffMembersStore } from '../store/staff-members-store';
import { MemberDetail, MemberSelect } from './manage-permissions-parts';

/**
 * Permissions editor. Pure presentation: it reads the roster ViewModel from the
 * staff-members store and dispatches grant / identity-block actions. Hidden,
 * capability flags, and the permission-set mutation all live in the controller.
 */
const ManagePermissionsView = ({
  store,
}: {
  readonly store: StaffMembersStore;
}) => {
  const vm = useStore(store, (s) => s.vm);
  const notice = useStore(store, (s) => s.notice);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  if (!vm || vm.hidden) return null;
  const selected = vm.members.find((m) => m.membershipId === selectedId);

  return (
    <section aria-label="manage permissions">
      <h2>Manage permissions</h2>
      <MemberSelect
        members={vm.members}
        value={selectedId}
        onChange={setSelectedId}
      />
      {selected ? (
        <MemberDetail
          member={selected}
          availableRoles={vm.availableRoles}
          notice={notice ?? undefined}
          canEdit={vm.canEdit}
          canBlock={vm.canBlock}
          onAdd={(action, scope) =>
            void store
              .getState()
              .grant({ membershipId: selected.membershipId, action, scope })
          }
          onAssignRoles={(roleIds) =>
            void store.getState().assignRoles(selected.membershipId, roleIds)
          }
          onBlock={(blocked) =>
            store.getState().setIdentityBlocked(selected.userId, blocked)
          }
        />
      ) : null}
    </section>
  );
};

export const ManagePermissionsForm = () => {
  const store = useStaffMembersStore();
  if (!store) return null;
  return <ManagePermissionsView store={store} />;
};
