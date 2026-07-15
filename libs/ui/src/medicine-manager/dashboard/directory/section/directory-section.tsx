import { useEffect } from 'react';
import { useDirectoryStore, useStore } from '../../store/hooks';
import type { DirectoryStore } from '../../store/directory-store';
import { DirectoryView } from '../directory.view';
import type { DirectoryActions, DirectoryVM } from '../directory.columns';
import { toast } from '../../../../design-system/toast/toaster';
import { copyFreshLink } from './invite-link';

/**
 * The DI-bound Directory container (ADR-0017 giro-owned). Reads the ViewModel
 * from the store and dispatches the backed actions (block / admin / invite /
 * regenerate) to it; navigation (open org / staff) comes from the parent, and
 * the not-yet-backed actions (demote, deletion, export, void/refund, invite/
 * revoke) are inert until their use cases land. Presentational logic stays in
 * `DirectoryView` — this only wires.
 */
const noop = () => undefined;

const LOADING_VM: DirectoryVM = {
  staff: [],
  customers: [],
  pendingInvitations: [],
  orphans: [],
  canBlock: false,
  canAdminAccounts: false,
  loading: true,
};

type Nav = {
  readonly onOpenOrg: (accountId: string) => void;
  readonly onOpenStaff: (accountId: string) => void;
};

const buildActions = (store: DirectoryStore, nav: Nav): DirectoryActions => ({
  onBlock: (id, blocked) => void store.getState().block('org', id, blocked),
  onAdmin: (id, action) => void store.getState().admin(action, id),
  // Both MINT a one-time token. It is shown exactly once (only its hash is
  // stored), so the container puts it straight on the clipboard — there is no
  // second chance to fetch it, and no mailer to send it (see onResendInvite).
  onRegenerate: (id) =>
    void store
      .getState()
      .regenerate(id)
      .then((r) =>
        copyFreshLink(r, 'New link copied — the previous one no longer works.'),
      ),
  onInvite: (email) =>
    void store
      .getState()
      .invite(email)
      .then((r) => copyFreshLink(r, 'Invitation created — link copied.')),
  // `id` here is the staff row's userId (identity space), NOT its accountId —
  // `identity.block` moderates the IDENTITY across every org.
  onBlockStaff: (userId, blocked) =>
    void store.getState().block('identity', userId, blocked),
  onDisableStaff: (id, disabled) =>
    void store.getState().admin(disabled ? 'disable' : 'enable', id),
  onOpenOrg: nav.onOpenOrg,
  onOpenStaff: nav.onOpenStaff,
  onRevokeInvitation: (id) => void store.getState().revoke(id),
  onResendInvite: (id) =>
    void store
      .getState()
      .resend(id)
      .then((error) =>
        error
          ? toast.error(error)
          : toast.success('A fresh link is on its way — the old one is dead.'),
      ),
  onInviteOrphan: noop,
  onDeleteOrphan: noop,
  onScheduleDeletion: noop,
  onCancelDeletion: noop,
  onExportOrg: noop,
  onExportDirectory: noop,
  onDemoteStaff: noop,
});

const DirectoryBound = ({
  store,
  nav,
}: {
  readonly store: DirectoryStore;
  readonly nav: Nav;
}) => {
  const vm = useStore(store, (s) => s.vm);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  return <DirectoryView vm={vm ?? LOADING_VM} {...buildActions(store, nav)} />;
};

export const DirectorySection = ({ onOpenOrg, onOpenStaff }: Nav) => {
  const store = useDirectoryStore();
  if (!store) return null;
  return <DirectoryBound store={store} nav={{ onOpenOrg, onOpenStaff }} />;
};
