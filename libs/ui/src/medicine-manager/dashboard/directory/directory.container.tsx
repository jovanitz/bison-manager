import { useEffect } from 'react';
import { useDirectoryStore, useStore } from '../store/hooks';
import type { DirectoryStore } from '../store/directory-store';
import { DirectoryView } from './directory.view';
import type { DirectoryActions, DirectoryVM } from './directory.columns';
import { toast } from '../../../design-system/toast/toaster';
import { copyFreshLink } from './section/invite-link';
import { directoryCsv, downloadCsv, orgCsv } from './section/csv-export';

/**
 * The DI-bound Directory container (ADR-0017 giro-owned). Reads the ViewModel
 * from the store and dispatches every action to it: block / admin (disable,
 * enable, promote, demote, schedule/cancel deletion) / invite / regenerate /
 * revoke / resend / orphan purge, plus the client-side CSV export. Navigation
 * (open org / staff) comes from the parent. The only remaining inert actions
 * are billing void/refund — the ledger has no charges wired yet. Presentational
 * logic stays in `DirectoryView` — this only wires.
 */
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
  // An orphan belongs to no org, so "invite as staff" is just an invite into OUR
  // staff account — the same use case the directory CTA calls. The row supplies
  // the email; one without an email cannot be invited and the menu disables it.
  onInviteOrphan: (email) =>
    void store
      .getState()
      .invite(email)
      .then((r) => copyFreshLink(r, 'Invitation created — link copied.')),
  onDeleteOrphan: (userId) => void store.getState().purgeOrphan(userId),
  onScheduleDeletion: (accountId) =>
    void store.getState().admin('scheduleDeletion', accountId),
  onCancelDeletion: (accountId) =>
    void store.getState().admin('cancelDeletion', accountId),
  // Client-side CSV of the current view / selection — the data already lives in
  // the VM, so there is no backend call, just a projection + a browser download.
  onExportOrg: (accountId) => {
    const csv = orgCsv(store.getState().vm?.customers ?? [], accountId);
    if (csv) downloadCsv(`organization-${accountId}.csv`, csv);
  },
  onExportDirectory: (accountIds) =>
    downloadCsv(
      'organizations.csv',
      directoryCsv(store.getState().vm?.customers ?? [], accountIds),
    ),
  onDemoteStaff: (accountId) =>
    void store.getState().admin('demote', accountId),
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
