import { type FormEvent, useEffect, useState } from 'react';
import type { RoleTemplateDto } from '@acme/application';
import { useTemplatesStore, useStore } from '../store/hooks';
import type { TemplatesStore } from '../store/templates-store';

/** Rename a template (its permissions are preserved). Pure dispatch. */
const RenameTemplateForm = ({
  store,
  template,
}: {
  readonly store: TemplatesStore;
  readonly template: RoleTemplateDto;
}) => {
  const [name, setName] = useState(template.name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void store.getState().updateTemplate({
      key: template.key,
      name,
      permissions: template.permissions,
    });
  };

  return (
    <form aria-label={`rename template ${template.key}`} onSubmit={submit}>
      <input
        aria-label={`template name ${template.key}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Template name"
      />
      <button type="submit">Save</button>
    </form>
  );
};

const TemplatesView = ({ store }: { readonly store: TemplatesStore }) => {
  const vm = useStore(store, (s) => s.vm);
  const notice = useStore(store, (s) => s.notice);
  const canManage = vm?.canManage ?? false;

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  return (
    <section aria-label="default templates section">
      <h2>Default templates ({vm ? vm.templates.length : 0})</h2>
      <p>
        The starting role catalogue new orgs are seeded from and can reset to.
        Editing a template does not touch live roles.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      <table aria-label="default templates">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scope</th>
            <th>Permissions</th>
            {canManage ? <th>Manage</th> : null}
          </tr>
        </thead>
        <tbody>
          {(vm?.templates ?? []).map((template) => (
            <tr key={template.key}>
              <td>{template.name}</td>
              <td>{template.scope}</td>
              <td>
                {template.permissions
                  .map((p) => `${p.action}:${p.scope}`)
                  .join(', ') || '—'}
              </td>
              {canManage ? (
                <td>
                  <RenameTemplateForm store={store} template={template} />
                  <button
                    type="button"
                    onClick={() =>
                      void store.getState().resetTemplate(template.key)
                    }
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void store.getState().applyToAll(template.key)
                    }
                  >
                    Apply to all
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const TemplatesSection = () => {
  const store = useTemplatesStore();
  if (!store) return null;
  return <TemplatesView store={store} />;
};
