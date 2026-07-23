/**
 * The shared permission editor (ADR-0011): a role/template is a NAME plus an
 * editable set of {action, scope} pairs. Add/remove rows; each row is a free
 * action string + a scope. Controlled — a pure function of `permissions` + an
 * onChange. The single affordance both Create and Edit (roles + templates) reuse
 * so a multi-permission bundle is authorable and editable, not display-only.
 */
import { Plus, X } from 'lucide-react';
import { Button } from '../../../../design-system/button/button';
import { Input } from '../../../../design-system/input/input';
import { Label } from '../../../../design-system/label/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../design-system/select/select';
import type { Permission, PermissionsPatch } from '../roles.types';

const SCOPES = ['any', 'own'] as const;

/** A role/template needs at least one permission, none with a blank action. */
export const permissionsInvalid = (
  permissions: readonly Permission[],
): boolean =>
  permissions.length === 0 || permissions.some((p) => p.action.trim() === '');

const PermissionRow = ({
  permission,
  onPatch,
  onRemove,
}: {
  readonly permission: Permission;
  readonly onPatch: (patch: Partial<Permission>) => void;
  readonly onRemove: () => void;
}) => (
  <div className="flex items-center gap-2">
    <Input
      aria-label="action"
      value={permission.action}
      onChange={(e) => onPatch({ action: e.target.value })}
      placeholder="staff.read"
      className="flex-1 font-mono text-sm"
    />
    <Select
      value={permission.scope}
      onValueChange={(scope) => onPatch({ scope })}
    >
      <SelectTrigger className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCOPES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Remove permission"
      onClick={onRemove}
    >
      <X />
    </Button>
  </div>
);

export const PermissionEditor = ({
  permissions,
  onChange,
}: {
  readonly permissions: readonly Permission[];
  readonly onChange: PermissionsPatch;
}) => {
  const patch = (index: number, part: Partial<Permission>) =>
    onChange(permissions.map((p, i) => (i === index ? { ...p, ...part } : p)));
  const remove = (index: number) =>
    onChange(permissions.filter((_, i) => i !== index));
  const add = () => onChange([...permissions, { action: '', scope: 'any' }]);
  return (
    <div className="grid gap-2">
      <Label>Permissions</Label>
      {permissions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          No permissions yet — a role needs at least one.
        </p>
      ) : (
        permissions.map((permission, i) => (
          <PermissionRow
            // Rows are append/remove-only; the controlled values stay correct.
            key={i}
            permission={permission}
            onPatch={(part) => patch(i, part)}
            onRemove={() => remove(i)}
          />
        ))
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={add}
      >
        <Plus /> Add permission
      </Button>
    </div>
  );
};
