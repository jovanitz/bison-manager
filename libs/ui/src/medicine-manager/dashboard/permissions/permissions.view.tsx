/**
 * Medicine Manager · Dashboard · Permissions — per-member grants, role
 * assignment, identity block and sessions (re-skin of the implemented
 * manage-permissions-form + member-sessions).
 *
 * @screen Medicine Manager / Dashboard / Permissions
 * @phase draft
 *
 * Presentational: types live in ./permissions.types (import-free) so the view
 * and its parts share them without a cycle. Member selection is local view
 * state; everything else is DATA + actions.
 */
import { useState } from 'react';
import { Label } from '../../../design-system/label/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../design-system/select/select';
import { MemberDetail } from './permissions.member-detail';
import { SessionsPanel } from './permissions.sessions';
import type {
  PermissionsActions,
  PermissionsVM,
  SessionRow,
} from './permissions.types';

export type {
  MemberRow,
  PermissionsActions,
  PermissionsVM,
  RoleOption,
  SessionRow,
} from './permissions.types';

export const PermissionsView = ({
  vm,
  sessions,
  onGrant,
  onAssignRoles,
  onBlockIdentity,
  onLoadSessions,
  onRevokeSession,
  onRevokeAll,
}: {
  readonly vm: PermissionsVM;
  readonly sessions: readonly SessionRow[];
} & PermissionsActions) => {
  const [selectedId, setSelectedId] = useState('');
  const selected = vm.members.find((m) => m.membershipId === selectedId);
  const select = (id: string) => {
    setSelectedId(id);
    if (vm.canReadSessions) onLoadSessions(id);
  };
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Manage permissions
        </h1>
        <p className="text-sm text-muted-foreground">
          Grant permissions, assign roles and manage sessions per member.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Member</Label>
        <Select value={selectedId} onValueChange={select}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a member" />
          </SelectTrigger>
          <SelectContent>
            {vm.members.map((m) => (
              <SelectItem key={m.membershipId} value={m.membershipId}>
                {m.displayName ?? m.email ?? m.membershipId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {selected ? (
        <MemberDetail
          member={selected}
          availableRoles={vm.availableRoles}
          canEdit={vm.canEdit}
          canBlock={vm.canBlock}
          notice={vm.notice}
          onGrant={onGrant}
          onAssignRoles={onAssignRoles}
          onBlockIdentity={onBlockIdentity}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Select a member to manage their access.
        </p>
      )}
      {selected && vm.canReadSessions ? (
        <SessionsPanel
          sessions={sessions}
          onRevoke={(sid) => onRevokeSession(sid, selected.membershipId)}
          onRevokeAll={() => onRevokeAll(selected.membershipId)}
        />
      ) : null}
    </div>
  );
};
