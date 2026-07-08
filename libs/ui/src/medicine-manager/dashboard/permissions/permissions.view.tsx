/**
 * Medicine Manager · Dashboard · Staff Detail — a staff member's access:
 * per-member grants, role assignment, identity block and sessions. Reached by
 * clicking a row in the Directory · Staff tab (folds in the old Permissions
 * section — access is per-identity, so it lives on the person).
 *
 * @screen Medicine Manager / Dashboard / Staff Detail
 * @phase draft
 *
 * Presentational: composes the reusable MemberDetail + SessionsPanel over a
 * single, pre-selected member. Types live in ./permissions.types (import-free).
 */
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../../design-system/button/button';
import { MemberDetail } from './permissions.member-detail';
import { SessionsPanel } from './permissions.sessions';
import type {
  MemberRow,
  PermissionsActions,
  RoleOption,
  SessionRow,
} from './permissions.types';

export type {
  MemberRow,
  PermissionsActions,
  RoleOption,
  SessionRow,
} from './permissions.types';

export type StaffDetailVM = {
  readonly member: MemberRow;
  readonly availableRoles: readonly RoleOption[];
  readonly sessions: readonly SessionRow[];
  readonly canEdit: boolean;
  readonly canBlock: boolean;
  readonly canReadSessions: boolean;
  readonly notice?: string | undefined;
};

export const StaffDetailView = ({
  vm,
  onBack,
  onGrant,
  onAssignRoles,
  onBlockIdentity,
  onRevokeSession,
  onRevokeAll,
}: { readonly vm: StaffDetailVM; readonly onBack: () => void } & Pick<
  PermissionsActions,
  | 'onGrant'
  | 'onAssignRoles'
  | 'onBlockIdentity'
  | 'onRevokeSession'
  | 'onRevokeAll'
>) => (
  <div className="flex max-w-2xl flex-col gap-6">
    <Button
      variant="ghost"
      size="sm"
      onClick={onBack}
      className="-ml-2 w-fit text-muted-foreground"
    >
      <ArrowLeft /> Directory
    </Button>
    <div>
      <h1 className="text-xl font-semibold text-foreground">
        {vm.member.displayName ?? vm.member.email ?? vm.member.membershipId}
      </h1>
      <p className="text-sm text-muted-foreground">
        Staff access — permissions, roles and sessions.
      </p>
    </div>
    <MemberDetail
      member={vm.member}
      availableRoles={vm.availableRoles}
      canEdit={vm.canEdit}
      canBlock={vm.canBlock}
      notice={vm.notice}
      onGrant={onGrant}
      onAssignRoles={onAssignRoles}
      onBlockIdentity={onBlockIdentity}
    />
    {vm.canReadSessions ? (
      <SessionsPanel
        sessions={vm.sessions}
        onRevoke={(sid) => onRevokeSession(sid, vm.member.membershipId)}
        onRevokeAll={() => onRevokeAll(vm.member.membershipId)}
      />
    ) : null}
  </div>
);
