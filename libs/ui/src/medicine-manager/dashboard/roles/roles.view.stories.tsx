import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RolesView } from './roles.view';
import type {
  DeleteRoleVM,
  ResetRoleVM,
  RoleFormVM,
  RoleRow,
  RolesActions,
  RolesVM,
} from './roles.types';
import {
  rolesVM,
  rolesLoadingVM,
  rolesErrorVM,
  rolesReadOnlyVM,
  createRoleVM,
  editRoleVM,
  deleteRoleVM,
  resetRoleVM,
  blankRole,
  draftFromRole,
} from './roles.fixtures';
import { DashboardShell } from '../dashboard.shell';

const meta: Meta<typeof RolesView> = {
  title: 'Medicine Manager/Dashboard/Roles',
  component: RolesView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof RolesView>;

const noop: RolesActions = {
  onCreate: () => undefined,
  onEdit: () => undefined,
  onSubmitForm: () => undefined,
  onCancelForm: () => undefined,
  onDelete: () => undefined,
  onConfirmDelete: () => undefined,
  onCancelDelete: () => undefined,
  onReset: () => undefined,
  onConfirmReset: () => undefined,
  onCancelReset: () => undefined,
};

const inShell = (vm: RolesVM) =>
  function Render() {
    return (
      <DashboardShell active="Roles">
        <RolesView vm={vm} {...noop} />
      </DashboardShell>
    );
  };

/** One open overlay at a time — the story-local state the host drives. */
type Flow = {
  readonly form?: RoleFormVM | undefined;
  readonly pendingDelete?: DeleteRoleVM | undefined;
  readonly pendingReset?: ResetRoleVM | undefined;
};

const byId = (id: string): RoleRow | undefined =>
  rolesVM.roles.find((r) => r.id === id);

const openers = (
  setFlow: Dispatch<SetStateAction<Flow>>,
): Pick<RolesActions, 'onCreate' | 'onEdit' | 'onDelete' | 'onReset'> => ({
  onCreate: () =>
    setFlow({ form: { mode: 'create', roleId: null, draft: blankRole } }),
  onEdit: (id) => {
    const r = byId(id);
    if (r)
      setFlow({ form: { mode: 'edit', roleId: id, draft: draftFromRole(r) } });
  },
  onDelete: (id) => {
    const r = byId(id);
    if (r) setFlow({ pendingDelete: { roleId: id, name: r.name } });
  },
  onReset: (id) => {
    const r = byId(id);
    if (r) setFlow({ pendingReset: { roleId: id, name: r.name } });
  },
});

const FlowHost = ({ initial }: { readonly initial: Flow }) => {
  const [flow, setFlow] = useState<Flow>(initial);
  const closed = () => setFlow({});
  return (
    <DashboardShell active="Roles">
      <RolesView
        vm={{ ...rolesVM, ...flow }}
        {...openers(setFlow)}
        onSubmitForm={closed}
        onCancelForm={closed}
        onConfirmDelete={closed}
        onCancelDelete={closed}
        onConfirmReset={closed}
        onCancelReset={closed}
      />
    </DashboardShell>
  );
};

/** Staff with permissions.update: create, edit (multi-permission), reset/delete. */
export const Populated: Story = { render: () => <FlowHost initial={{}} /> };
export const Loading: Story = { render: inShell(rolesLoadingVM) };
export const ErrorState: Story = { render: inShell(rolesErrorVM) };
/** No permissions.update — catalog readable, no create/edit/manage levers. */
export const ReadOnly: Story = { render: inShell(rolesReadOnlyVM) };
/** The role editor open on a blank draft — name + add/remove permission rows. */
export const CreateRole: Story = {
  render: () => <FlowHost initial={{ form: createRoleVM.form }} />,
};
/** Editing "Support" — a multi-permission role; the footer notes the live ripple. */
export const EditRole: Story = {
  render: () => <FlowHost initial={{ form: editRoleVM.form }} />,
};
/** Deleting a custom role — warns the server refuses if still assigned. */
export const DeleteConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingDelete: deleteRoleVM.pendingDelete }} />
  ),
};
/** Resetting a forked default back to its factory template. */
export const ResetConfirm: Story = {
  render: () => (
    <FlowHost initial={{ pendingReset: resetRoleVM.pendingReset }} />
  ),
};
