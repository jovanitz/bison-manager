/**
 * Interactive Roles + Templates prototype sections — the redesigned catalog,
 * wired to a SIMULATED backend (close-on-action + a toast) so the editor,
 * confirm gates and states are real to click through. Prototype-only scaffolding
 * (no real logic); the views stay pure (fn of VM + actions).
 */
import { useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from '../../../design-system/toast/toaster';
import { RolesView } from '../roles/roles.view';
import { TemplatesView } from '../roles/templates.view';
import type { RolesActions, TemplatesActions } from '../roles/roles.types';
import {
  rolesVM,
  blankRole,
  draftFromRole,
  templatesVM,
  draftFromTemplate,
} from '../roles/roles.fixtures';

type RoleFlow = NonNullable<
  Pick<
    Parameters<typeof RolesView>[0]['vm'],
    'form' | 'pendingDelete' | 'pendingReset'
  >
>;

const roleActions = (
  setFlow: Dispatch<SetStateAction<RoleFlow>>,
): RolesActions => {
  const close = () => setFlow({});
  const byId = (id: string) => rolesVM.roles.find((r) => r.id === id);
  return {
    onCreate: () =>
      setFlow({ form: { mode: 'create', roleId: null, draft: blankRole } }),
    onEdit: (id) => {
      const r = byId(id);
      if (r)
        setFlow({
          form: { mode: 'edit', roleId: id, draft: draftFromRole(r) },
        });
    },
    onSubmitForm: () => {
      toast.success('Role saved');
      close();
    },
    onCancelForm: close,
    onDelete: (id) => {
      const r = byId(id);
      if (r) setFlow({ pendingDelete: { roleId: id, name: r.name } });
    },
    onConfirmDelete: () => {
      toast.success('Role deleted');
      close();
    },
    onCancelDelete: close,
    onReset: (id) => {
      const r = byId(id);
      if (r) setFlow({ pendingReset: { roleId: id, name: r.name } });
    },
    onConfirmReset: () => {
      toast.success('Role reset to its template');
      close();
    },
    onCancelReset: close,
  };
};

export const RolesSection = () => {
  const [flow, setFlow] = useState<RoleFlow>({});
  return <RolesView vm={{ ...rolesVM, ...flow }} {...roleActions(setFlow)} />;
};

type TemplateFlow = NonNullable<
  Pick<
    Parameters<typeof TemplatesView>[0]['vm'],
    'form' | 'pendingReset' | 'pendingApply'
  >
>;

const templateActions = (
  setFlow: Dispatch<SetStateAction<TemplateFlow>>,
): TemplatesActions => {
  const close = () => setFlow({});
  const byKey = (key: string) =>
    templatesVM.templates.find((t) => t.key === key);
  return {
    onEdit: (key) => {
      const t = byKey(key);
      if (t)
        setFlow({ form: { key, scope: t.scope, draft: draftFromTemplate(t) } });
    },
    onSubmitForm: () => {
      toast.success('Template saved — new orgs will seed from it');
      close();
    },
    onCancelForm: close,
    onReset: (key) => {
      const t = byKey(key);
      if (t) setFlow({ pendingReset: { key, name: t.name } });
    },
    onConfirmReset: () => {
      toast.success('Template reset to its code definition');
      close();
    },
    onCancelReset: close,
    onApplyToAll: (key) => {
      const t = byKey(key);
      if (t) setFlow({ pendingApply: { key, name: t.name } });
    },
    onConfirmApply: () => {
      toast.success('Applied to 8 live roles');
      close();
    },
    onCancelApply: close,
  };
};

export const TemplatesSection = () => {
  const [flow, setFlow] = useState<TemplateFlow>({});
  return (
    <TemplatesView
      vm={{ ...templatesVM, ...flow }}
      {...templateActions(setFlow)}
    />
  );
};
