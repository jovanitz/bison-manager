import { useState } from 'react';
import { useUseCases } from '../../di/use-cases-context';
import { InviteMember } from './invite-member';
import { MemberList } from './member-list';
import { useOrgAdmin } from './use-org-admin';

/**
 * The org admin's control panel inside the CLIENT app: invite members into
 * their own org, grant them delegable (own-scope) permissions, and remove them.
 * Hidden entirely for members who can't read the roster; every control is
 * additionally gated by capability and re-enforced server-side.
 */
export const ManageOrgSection = () => {
  const { members } = useUseCases();
  const { state, reload } = useOrgAdmin();
  const [notice, setNotice] = useState<string | undefined>();

  if (state.kind === 'hidden') return null;
  if (state.kind === 'loading') return <p>Loading organization…</p>;
  if (state.kind === 'error') return <p role="alert">{state.message}</p>;

  const onAdd = async (membershipId: string, action: string) => {
    setNotice(undefined);
    const member = state.members.find((m) => m.membershipId === membershipId);
    if (!member || !members) return;
    const result = await members.updatePermissions({
      membershipId,
      permissions: [...member.permissions, { action, scope: 'own' }],
    });
    if (!result.ok) return setNotice(result.error.message);
    await reload();
  };

  const onRemove = async (membershipId: string) => {
    setNotice(undefined);
    if (!members) return;
    const result = await members.removeMember({ membershipId });
    if (!result.ok) return setNotice(result.error.message);
    await reload();
  };

  const onBlock = async (membershipId: string, blocked: boolean) => {
    setNotice(undefined);
    if (!members) return;
    const result = await members.setMemberBlocked({ membershipId, blocked });
    if (!result.ok) return setNotice(result.error.message);
    await reload();
  };

  return (
    <section aria-label="manage organization">
      <h2>Manage your organization</h2>
      {state.canInvite ? (
        <InviteMember
          accountId={state.access.accountId}
          onInvited={() => void reload()}
        />
      ) : null}
      <MemberList
        members={state.members}
        caps={{
          canEdit: state.canEdit,
          canRemove: state.canRemove,
          canBlock: state.canBlock,
        }}
        handlers={{
          onAdd: (id, action) => void onAdd(id, action),
          onRemove: (id) => void onRemove(id),
          onBlock: (id, blocked) => void onBlock(id, blocked),
        }}
        notice={notice}
      />
    </section>
  );
};
