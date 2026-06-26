import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CurrentAccessDto } from '@acme/application';
import {
  mockAccessUseCases,
  mockItems,
  testCurrentAccess,
} from '../../access/testing';
import { mockRoles } from '../../dashboard/testing';
import { UseCasesProvider, type AppUseCases } from '../../di/use-cases-context';
import { ManageRolesSection } from './manage-roles-section';

const ADMIN: CurrentAccessDto = {
  ...testCurrentAccess,
  permissions: [{ action: 'permissions.update', scope: 'own' }],
};

const renderSection = (useCases: Partial<AppUseCases>, access = ADMIN) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({ currentAccess: async () => ok(access) }),
        ...useCases,
      }}
    >
      <ManageRolesSection />
    </UseCasesProvider>,
  );

describe('ManageRolesSection', () => {
  it('lists the org roles with the create form for an admin', async () => {
    renderSection({ roles: mockRoles() });
    expect(await screen.findByText('Support')).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'create org role' }),
    ).toBeInTheDocument();
  });

  it('hides the section without permissions.update', async () => {
    renderSection(
      { roles: mockRoles() },
      {
        ...testCurrentAccess,
        permissions: [{ action: 'customer.read', scope: 'own' }],
      },
    );
    // loadOrgRoles returns hidden → the table never renders
    await waitFor(() =>
      expect(
        screen.queryByRole('table', { name: 'org roles' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('creates a role scoped to the org (own scope)', async () => {
    const createRole = vi.fn(async () => ({
      ok: true as const,
      value: { roleId: 'r-9' },
    }));
    renderSection({ roles: mockRoles({ createRole }) });
    fireEvent.change(await screen.findByLabelText('org role name'), {
      target: { value: 'Front desk' },
    });
    fireEvent.change(screen.getByLabelText('org role action'), {
      target: { value: 'members.read' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create role/i }));
    await waitFor(() =>
      expect(createRole).toHaveBeenCalledWith({
        name: 'Front desk',
        accountId: testCurrentAccess.accountId,
        permissions: [{ action: 'members.read', scope: 'own' }],
      }),
    );
  });

  it('resets a default role and deletes a custom one', async () => {
    const resetRole = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }));
    const deleteRole = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }));
    renderSection({ roles: mockRoles({ resetRole, deleteRole }) });
    expect(await screen.findByText('Support')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(resetRole).toHaveBeenCalledWith('role-support'));
    expect(deleteRole).toHaveBeenCalledWith('role-custom');
  });
});
