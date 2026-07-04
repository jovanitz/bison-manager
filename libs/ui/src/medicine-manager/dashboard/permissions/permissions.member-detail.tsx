import { useState, type FormEvent } from 'react';
import { Button } from '../../../design-system/button/button';
import { Badge } from '../../../design-system/badge/badge';
import { Input } from '../../../design-system/input/input';
import { Label } from '../../../design-system/label/label';
import { Switch } from '../../../design-system/switch/switch';
import { Checkbox } from '../../../design-system/checkbox/checkbox';
import { Alert, AlertDescription } from '../../../design-system/alert/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../design-system/select/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../design-system/card/card';
import type {
  MemberRow,
  PermissionsActions,
  RoleOption,
} from './permissions.types';

const GrantForm = ({
  onGrant,
}: {
  readonly onGrant: (action: string, scope: string) => void;
}) => {
  const [action, setAction] = useState('');
  const [scope, setScope] = useState('any');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onGrant(action, scope);
    setAction('');
  };
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="grant-action">Grant permission</Label>
        <Input
          id="grant-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="staff.read"
        />
      </div>
      <Select value={scope} onValueChange={setScope}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">any</SelectItem>
          <SelectItem value="own">own</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Add</Button>
    </form>
  );
};

const PermissionBadges = ({
  permissions,
}: {
  readonly permissions: readonly string[];
}) => (
  <div className="grid gap-1.5">
    <Label>Permissions</Label>
    <div className="flex flex-wrap gap-1">
      {permissions.length
        ? permissions.map((p) => (
            <Badge key={p} variant="outline" className="font-mono">
              {p}
            </Badge>
          ))
        : '—'}
    </div>
  </div>
);

const RoleToggles = ({
  availableRoles,
  roleIds,
  canEdit,
  onToggle,
}: {
  readonly availableRoles: readonly RoleOption[];
  readonly roleIds: readonly string[];
  readonly canEdit: boolean;
  readonly onToggle: (id: string) => void;
}) => (
  <div className="grid gap-1.5">
    <Label>Roles</Label>
    <div className="grid gap-2 sm:grid-cols-2">
      {availableRoles.map((r) => (
        <label key={r.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={roleIds.includes(r.id)}
            onCheckedChange={() => onToggle(r.id)}
            disabled={!canEdit}
          />
          {r.name}
        </label>
      ))}
    </div>
  </div>
);

const MemberHeader = ({
  member,
  canBlock,
  onBlockIdentity,
}: {
  readonly member: MemberRow;
  readonly canBlock: boolean;
} & Pick<PermissionsActions, 'onBlockIdentity'>) => (
  <CardHeader className="flex-row items-center justify-between space-y-0">
    <div>
      <CardTitle className="text-base">
        {member.displayName ?? member.email ?? member.membershipId}
      </CardTitle>
      {member.email ? <CardDescription>{member.email}</CardDescription> : null}
    </div>
    {canBlock ? (
      <div className="flex items-center gap-2">
        <Label htmlFor="blocked">Blocked</Label>
        <Switch
          id="blocked"
          checked={member.blocked}
          onCheckedChange={(v) => onBlockIdentity(member.userId, v)}
        />
      </div>
    ) : null}
  </CardHeader>
);

export const MemberDetail = ({
  member,
  availableRoles,
  canEdit,
  canBlock,
  notice,
  onGrant,
  onAssignRoles,
  onBlockIdentity,
}: {
  readonly member: MemberRow;
  readonly availableRoles: readonly RoleOption[];
  readonly canEdit: boolean;
  readonly canBlock: boolean;
  readonly notice?: string | undefined;
} & Pick<
  PermissionsActions,
  'onGrant' | 'onAssignRoles' | 'onBlockIdentity'
>) => {
  const toggleRole = (id: string) =>
    onAssignRoles(
      member.membershipId,
      member.roleIds.includes(id)
        ? member.roleIds.filter((r) => r !== id)
        : [...member.roleIds, id],
    );
  return (
    <Card>
      <MemberHeader
        member={member}
        canBlock={canBlock}
        onBlockIdentity={onBlockIdentity}
      />
      <CardContent className="flex flex-col gap-4">
        {notice ? (
          <Alert variant="info">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
        <PermissionBadges permissions={member.permissions} />
        <RoleToggles
          availableRoles={availableRoles}
          roleIds={member.roleIds}
          canEdit={canEdit}
          onToggle={toggleRole}
        />
        {canEdit ? (
          <GrantForm
            onGrant={(action, scope) =>
              onGrant(member.membershipId, action, scope)
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
};
