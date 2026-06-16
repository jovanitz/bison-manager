import { useCallback, useEffect, useState } from 'react';
import type { CurrentAccessDto, MemberSummaryDto } from '@acme/application';
import { useUseCases } from '../../di/use-cases-context';
import { holdsAction } from '../../dashboard/admin-access';

/**
 * Loads the org-admin view for the CLIENT app: the caller's own access snapshot
 * plus their organization's members, together with the capabilities that gate
 * the controls (invite / edit permissions / remove). Every capability only
 * *hides* what the server would refuse anyway — enforcement stays server-side.
 */
export type OrgAdminState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'error'; readonly message: string }
  | {
      readonly kind: 'ready';
      readonly access: CurrentAccessDto;
      readonly members: ReadonlyArray<MemberSummaryDto>;
      readonly canInvite: boolean;
      readonly canEdit: boolean;
      readonly canRemove: boolean;
      readonly canBlock: boolean;
    };

export const useOrgAdmin = () => {
  const { access, members } = useUseCases();
  const [state, setState] = useState<OrgAdminState>({ kind: 'loading' });

  const load = useCallback(async () => {
    if (!access || !members) return setState({ kind: 'hidden' });
    const snapshot = await access.currentAccess();
    if (!snapshot.ok)
      return setState({ kind: 'error', message: snapshot.error.message });
    // Only org admins (those who can read their members) see this section.
    if (!holdsAction(snapshot.value, 'members.read'))
      return setState({ kind: 'hidden' });
    const listed = await members.listMembers(snapshot.value.accountId);
    if (!listed.ok)
      return setState({ kind: 'error', message: listed.error.message });
    setState({
      kind: 'ready',
      access: snapshot.value,
      members: listed.value,
      canInvite: holdsAction(snapshot.value, 'members.invite'),
      canEdit: holdsAction(snapshot.value, 'permissions.update'),
      canRemove: holdsAction(snapshot.value, 'members.remove'),
      canBlock: holdsAction(snapshot.value, 'members.block'),
    });
  }, [access, members]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
};
