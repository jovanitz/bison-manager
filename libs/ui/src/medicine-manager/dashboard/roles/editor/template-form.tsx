/**
 * Edit a default-role template (ADR-0013): its name + permission set. Editing a
 * template NEVER touches live roles — new orgs seed from it, and existing roles
 * only change via "Apply to all". The key + scope are read-only context. Pure:
 * open/close + submitting/error are VM data; only the draft is local.
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
import type {
  TemplateDraft,
  TemplateFormVM,
  TemplatesActions,
} from '../roles.types';

export type TemplateFormProps = { readonly form: TemplateFormVM } & Pick<
  TemplatesActions,
  'onSubmitForm' | 'onCancelForm'
>;

export const TemplateFormDialog = ({
  form,
  onSubmitForm,
  onCancelForm,
}: TemplateFormProps) => {
  const [draft, setDraft] = useState<TemplateDraft>(form.draft);
  const invalid =
    draft.name.trim() === '' || permissionsInvalid(draft.permissions);
  return (
    <Dialog open onOpenChange={(o) => (o ? undefined : onCancelForm())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit “{form.draft.name}” template</DialogTitle>
        </DialogHeader>
        <Stack gap="field">
          {form.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn’t save the template</AlertTitle>
              <AlertDescription>{form.error}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Key: <span className="font-mono">{form.key}</span> · {form.scope}
          </p>
          <Stack gap="tight">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="Admin"
            />
          </Stack>
          <PermissionEditor
            permissions={draft.permissions}
            onChange={(permissions) => setDraft((d) => ({ ...d, permissions }))}
          />
          <p className="text-xs text-muted-foreground">
            Saving only reseeds NEW orgs. Existing roles change only via “Apply
            to all”.
          </p>
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
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
