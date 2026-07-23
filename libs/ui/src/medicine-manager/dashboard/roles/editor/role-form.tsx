/**
 * Create / edit a platform role (ADR-0011): a name + an editable permission set.
 * The same dialog for both — create opens blank, edit seeds from the row. An
 * edit is a live reference, so the footer says so (blast-radius disclosure).
 * Pure: open/close + submitting/error are VM data; only the draft is local.
 */
import { useState } from 'react';
import { Button } from '../../../../design-system/button/button';
import { Input } from '../../../../design-system/input/input';
import { Label } from '../../../../design-system/label/label';
import { Stack } from '../../../../design-system/stack/stack';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../../../design-system/alert/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system/dialog/dialog';
import { PermissionEditor, permissionsInvalid } from './permission-editor';
import type { RoleDraft, RoleFormVM, RolesActions } from '../roles.types';

export type RoleFormProps = { readonly form: RoleFormVM } & Pick<
  RolesActions,
  'onSubmitForm' | 'onCancelForm'
>;

export const RoleFormDialog = ({
  form,
  onSubmitForm,
  onCancelForm,
}: RoleFormProps) => {
  const [draft, setDraft] = useState<RoleDraft>(form.draft);
  const editing = form.mode === 'edit';
  const invalid =
    draft.name.trim() === '' || permissionsInvalid(draft.permissions);
  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onCancelForm())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit “${form.draft.name}”` : 'Create role'}
          </DialogTitle>
        </DialogHeader>
        <Stack gap="field">
          {form.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t save the role</AlertTitle>
              <AlertDescription>{form.error}</AlertDescription>
            </Alert>
          ) : null}
          <Stack gap="tight">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="Support"
            />
          </Stack>
          <PermissionEditor
            permissions={draft.permissions}
            onChange={(permissions) => setDraft((d) => ({ ...d, permissions }))}
          />
          {editing ? (
            <p className="text-xs text-muted-foreground">
              A role is a live reference — changes apply to everyone holding it
              on their next request.
            </p>
          ) : null}
        </Stack>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelForm}>
            Cancel
          </Button>
          <Button
            disabled={invalid}
            loading={form.submitting}
            onClick={() => onSubmitForm(draft)}
          >
            {editing ? 'Save changes' : 'Create role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
