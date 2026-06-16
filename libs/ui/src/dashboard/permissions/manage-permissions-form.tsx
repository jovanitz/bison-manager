import { useCallback, useEffect, useState } from 'react';
import type { MemberSummaryDto } from '@acme/application';
import { useUseCases } from '../../di/use-cases-context';
import { holdsAction } from '../admin-access';
import { MemberDetail, MemberSelect } from './manage-permissions-parts';

/**
 * Permissions editor: pick a member, see what they hold, add another from the
 * catalog. Hidden entirely without `members.read`; the add-permission control
 * needs `permissions.update` and the block control needs `access.block` — all
 * UI gating only, re-enforced server-side. The super-admin is never editable.
 */
type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly members: ReadonlyArray<MemberSummaryDto>;
      readonly canEdit: boolean;
      readonly canBlock: boolean;
    };

/** Loads the member list + the actor's edit/block capabilities (re-loadable). */
const useMembersState = () => {
  const { access, members } = useUseCases();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!access || !members) return;
    const snapshot = await access.currentAccess();
    if (!snapshot.ok) {
      setState({ kind: 'error', message: snapshot.error.message });
      return;
    }
    if (!holdsAction(snapshot.value, 'members.read')) {
      setState({ kind: 'hidden' });
      return;
    }
    const result = await members.listMembers(snapshot.value.accountId);
    setState(
      result.ok
        ? {
            kind: 'ready',
            members: result.value,
            canEdit: holdsAction(snapshot.value, 'permissions.update'),
            canBlock: holdsAction(snapshot.value, 'access.block'),
          }
        : { kind: 'error', message: result.error.message },
    );
  }, [access, members]);

  useEffect(() => {
    void load();
  }, [load]);

  return { access, members, state, reload: load };
};

export const ManagePermissionsForm = () => {
  const { access, members, state, reload } = useMembersState();
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState<string | undefined>();

  if (!access || !members || state.kind === 'hidden') return null;

  const selected =
    state.kind === 'ready'
      ? state.members.find((m) => m.membershipId === selectedId)
      : undefined;

  const onAdd = async (action: string, scope: string) => {
    if (!selected) return;
    setNotice(undefined);
    const result = await members.updatePermissions({
      membershipId: selected.membershipId,
      permissions: [...selected.permissions, { action, scope }],
    });
    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }
    await reload();
  };

  return (
    <section aria-label="manage permissions">
      <h2>Manage permissions</h2>
      {state.kind === 'loading' ? <p>Loading…</p> : null}
      {state.kind === 'error' ? <p role="alert">{state.message}</p> : null}
      {state.kind === 'ready' ? (
        <>
          <MemberSelect
            members={state.members}
            value={selectedId}
            onChange={setSelectedId}
          />
          {selected ? (
            <MemberDetail
              member={selected}
              notice={notice}
              canEdit={state.canEdit}
              canBlock={state.canBlock}
              onAdd={(a, s) => void onAdd(a, s)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
};
