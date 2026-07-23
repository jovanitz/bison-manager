import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import { Skeleton } from '../../../design-system/skeleton/skeleton';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../design-system/alert/alert';
import { useStaffDetailStore, useStore } from '../store/hooks';
import type { StaffDetailStore } from '../store/permissions/staff-detail-store';
import { StaffDetailView } from './permissions.view';
import type { PermissionsActions } from './permissions.types';

/**
 * The DI-bound Staff Detail container (ADR-0011, ADR-0017 giro-owned). Loads one
 * staff member's access (by identity) and dispatches its levers: assign roles
 * (the audited `member.roles-assigned`), grant a permission, revoke sessions.
 * Identity block is intentionally out of scope here — it lives in the Directory
 * staff tab (`canBlock: false`), so `onBlockIdentity` is never invoked.
 */
const buildActions = (
  store: StaffDetailStore,
): Pick<
  PermissionsActions,
  | 'onGrant'
  | 'onAssignRoles'
  | 'onBlockIdentity'
  | 'onLoadSessions'
  | 'onRevokeSession'
  | 'onRevokeAll'
> => {
  const state = () => store.getState();
  return {
    onGrant: (id, action, scope) => void state().grant(id, action, scope),
    onAssignRoles: (id, roleIds) => void state().assignRoles(id, roleIds),
    onBlockIdentity: () => undefined,
    onLoadSessions: () => undefined,
    onRevokeSession: (sessionId) => void state().revokeSession(sessionId),
    onRevokeAll: (id) => void state().revokeAll(id),
  };
};

const StaffDetailBound = ({
  store,
  onBack,
}: {
  readonly store: StaffDetailStore;
  readonly onBack: () => void;
}) => {
  const vm = useStore(store, (s) => s.vm);
  const error = useStore(store, (s) => s.error);
  useEffect(() => {
    void store.getState().load();
  }, [store]);
  if (error)
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 w-fit text-muted-foreground"
        >
          <ArrowLeft /> Directory
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load staff access</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  if (!vm) return <Skeleton className="h-96 max-w-2xl" />;
  return <StaffDetailView vm={vm} onBack={onBack} {...buildActions(store)} />;
};

export const StaffDetailSection = ({
  userId,
  accountId,
  onBack,
}: {
  readonly userId: string;
  readonly accountId: string;
  readonly onBack: () => void;
}) => {
  const store = useStaffDetailStore(userId, accountId);
  if (!store) return null;
  return <StaffDetailBound store={store} onBack={onBack} />;
};
