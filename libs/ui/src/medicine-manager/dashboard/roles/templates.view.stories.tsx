import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TemplatesView } from './templates.view';
import type {
  ApplyToAllVM,
  ResetTemplateVM,
  TemplateFormVM,
  TemplateRow,
  TemplatesActions,
  TemplatesVM,
} from './roles.types';
import {
  templatesVM,
  templatesLoadingVM,
  templatesReadOnlyVM,
  editTemplateVM,
  resetTemplateVM,
  applyTemplateVM,
  appliedNoticeVM,
  draftFromTemplate,
} from './roles.fixtures';
import { DashboardShell } from '../dashboard.shell';

const meta: Meta<typeof TemplatesView> = {
  title: 'Medicine Manager/Dashboard/Templates',
  component: TemplatesView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof TemplatesView>;

const noop: TemplatesActions = {
  onEdit: () => undefined,
  onSubmitForm: () => undefined,
  onCancelForm: () => undefined,
  onReset: () => undefined,
  onConfirmReset: () => undefined,
  onCancelReset: () => undefined,
  onApplyToAll: () => undefined,
  onConfirmApply: () => undefined,
  onCancelApply: () => undefined,
};

const inShell = (vm: TemplatesVM) =>
  function Render() {
    return (
      <DashboardShell active="Templates">
        <TemplatesView vm={vm} {...noop} />
      </DashboardShell>
    );
  };

type Flow = {
  readonly form?: TemplateFormVM | undefined;
  readonly pendingReset?: ResetTemplateVM | undefined;
  readonly pendingApply?: ApplyToAllVM | undefined;
};

const byKey = (key: string): TemplateRow | undefined =>
  templatesVM.templates.find((t) => t.key === key);

const openers = (
  setFlow: Dispatch<SetStateAction<Flow>>,
): Pick<TemplatesActions, 'onEdit' | 'onReset' | 'onApplyToAll'> => ({
  onEdit: (key) => {
    const t = byKey(key);
    if (t)
      setFlow({ form: { key, scope: t.scope, draft: draftFromTemplate(t) } });
  },
  onReset: (key) => {
    const t = byKey(key);
    if (t) setFlow({ pendingReset: { key, name: t.name } });
  },
  onApplyToAll: (key) => {
    const t = byKey(key);
    if (t) setFlow({ pendingApply: { key, name: t.name } });
  },
});

const FlowHost = ({ initial }: { readonly initial: Flow }) => {
  const [flow, setFlow] = useState<Flow>(initial);
  const closed = () => setFlow({});
  return (
    <DashboardShell active="Templates">
      <TemplatesView
        vm={{ ...templatesVM, ...flow }}
        {...openers(setFlow)}
        onSubmitForm={closed}
        onCancelForm={closed}
        onConfirmReset={closed}
        onCancelReset={closed}
        onConfirmApply={closed}
        onCancelApply={closed}
      />
    </DashboardShell>
  );
};

/** Staff with permissions.update: edit (name + permissions) / reset / apply-to-all. */
export const Populated: Story = { render: () => <FlowHost initial={{}} /> };
export const Loading: Story = { render: inShell(templatesLoadingVM) };
/** No permissions.update — catalog readable, no Manage column. */
export const ReadOnly: Story = { render: inShell(templatesReadOnlyVM) };
/** Editing the "Admin" template — name + add/remove permission rows. */
export const EditTemplate: Story = {
  render: () => <FlowHost initial={{ form: editTemplateVM.form }} />,
};
/** Reset the template to its code definition — live roles untouched. */
export const ResetConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingReset: resetTemplateVM.pendingReset }} />
  ),
};
/** Apply-to-all — the mass action; confirm spells out the blast radius. */
export const ApplyToAllConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingApply: applyTemplateVM.pendingApply }} />
  ),
};
/** After an apply — the result count surfaced as an info notice. */
export const AppliedNotice: Story = { render: inShell(appliedNoticeVM) };
