import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MembersUseCases, RolesGateway } from '@acme/application';
import { mockAccessUseCases, mockItems } from '../../access/testing';
import { UseCasesProvider } from '../../di/use-cases-context';
import { ManagePermissionsForm } from './manage-permissions-form';
import {
  adminAccess,
  mockBlock,
  mockMembers,
  mockRoles,
  mockSessions,
} from '../testing';
import type { CurrentAccessDto } from '@acme/application';

const renderForm = (
  members: MembersUseCases = mockMembers(),
  roles: RolesGateway = mockRoles(),
  extra: {
    access?: CurrentAccessDto;
    sessions?: ReturnType<typeof mockSessions>;
  } = {},
) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({
          currentAccess: async () => ({
            ok: true,
            value: extra.access ?? adminAccess,
          }),
        }),
        members,
        block: mockBlock(),
        roles,
        sessions: extra.sessions ?? mockSessions(),
      }}
    >
      <ManagePermissionsForm />
    </UseCasesProvider>,
  );

const selectMember = async (value: string) => {
  await waitFor(() => screen.getByRole('combobox', { name: 'member' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'member' }), {
    target: { value },
  });
};

describe('ManagePermissionsForm', () => {
  it('shows a member’s current permissions and adds one', async () => {
    const updatePermissions = vi.fn(async () => ({
      ok: true,
      value: undefined,
    }));
    renderForm(mockMembers({ updatePermissions }));

    await selectMember('m-staff');
    expect(
      screen.getByRole('list', { name: 'current permissions' }),
    ).toHaveTextContent('staff.read:any');

    fireEvent.change(screen.getByRole('combobox', { name: 'action' }), {
      target: { value: 'audit.read' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'scope' }), {
      target: { value: 'any' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add permission' }));

    await waitFor(() =>
      expect(updatePermissions).toHaveBeenCalledWith({
        membershipId: 'm-staff',
        permissions: [
          { action: 'staff.read', scope: 'any' },
          { action: 'audit.read', scope: 'any' },
        ],
      }),
    );
  });

  it('lists and revokes a member’s sessions when the actor may read them', async () => {
    const revoke = vi.fn(async () => ({ ok: true, value: undefined }));
    const auditor: CurrentAccessDto = {
      ...adminAccess,
      permissions: [
        ...adminAccess.permissions,
        { action: 'sessions.read', scope: 'any' },
      ],
    };
    renderForm(mockMembers(), mockRoles(), {
      access: auditor,
      sessions: mockSessions({ revoke }),
    });
    await selectMember('m-staff');
    expect(
      await screen.findByRole('list', { name: 'sessions' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[0]!);
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('sess-1'));
  });

  it('never offers to edit the protected super-admin', async () => {
    renderForm();
    await selectMember('m-root');
    expect(screen.getByRole('note')).toHaveTextContent(/cannot be changed/i);
    expect(
      screen.queryByRole('form', { name: 'add permission' }),
    ).not.toBeInTheDocument();
  });

  it('assigns roles: pre-checked from current, replaces on submit', async () => {
    const assignRoles = vi.fn(async () => ({ ok: true, value: undefined }));
    renderForm(mockMembers(), mockRoles({ assignRoles }));
    await selectMember('m-staff');

    const support = screen.getByRole('checkbox', { name: 'role Support' });
    expect(support).toBeChecked(); // m-staff carries role-support
    fireEvent.click(support); // unselect it
    fireEvent.click(screen.getByRole('button', { name: 'Set roles' }));

    await waitFor(() =>
      expect(assignRoles).toHaveBeenCalledWith({
        membershipId: 'm-staff',
        roleIds: [],
      }),
    );
  });
});
