import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockAccessUseCases, mockItems } from '../../access/testing';
import { UseCasesProvider } from '../../di/use-cases-context';
import { RolesSection } from './roles-section';
import { adminAccess, mockRoles } from '../testing';
import type { RolesGateway } from '@acme/application';

const renderSection = (
  roles: RolesGateway = mockRoles(),
  access = adminAccess,
) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({
          currentAccess: async () => ({ ok: true, value: access }),
        }),
        roles,
      }}
    >
      <RolesSection />
    </UseCasesProvider>,
  );

const readOnly = {
  ...adminAccess,
  permissions: [{ action: 'staff.read', scope: 'any' }],
};

describe('RolesSection', () => {
  it('lists roles and shows the create form for a manager', async () => {
    renderSection();
    expect(await screen.findByText('Support')).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'create role' }),
    ).toBeInTheDocument();
  });

  it('creates a platform role from the form (name + one permission)', async () => {
    const createRole = vi.fn(async () => ({
      ok: true as const,
      value: { roleId: 'r-9' },
    }));
    renderSection(mockRoles({ createRole }));
    fireEvent.change(await screen.findByLabelText('role name'), {
      target: { value: 'Auditor' },
    });
    fireEvent.change(screen.getByLabelText('permission action'), {
      target: { value: 'audit.read' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create role/i }));
    await waitFor(() =>
      expect(createRole).toHaveBeenCalledWith({
        name: 'Auditor',
        accountId: null,
        permissions: [{ action: 'audit.read', scope: 'any' }],
      }),
    );
  });

  it('hides the create form + delete for an actor without permissions.update', async () => {
    renderSection(mockRoles(), readOnly);
    // the list still loads, but management controls never appear
    expect(await screen.findByText('Support')).toBeInTheDocument();
    expect(
      screen.queryByRole('form', { name: 'create role' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it('offers Reset (not Delete) on a default role, with a badge', async () => {
    const resetRole = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }));
    renderSection(mockRoles({ resetRole }));
    expect(await screen.findByText('Support')).toBeInTheDocument();
    // the default (templateKey set) is badged and resettable
    expect(screen.getByLabelText('default role')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(resetRole).toHaveBeenCalledWith('role-support'));
    // the custom role keeps a Delete button
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('renders nothing when roles are not wired', () => {
    render(
      <UseCasesProvider useCases={{ items: mockItems }}>
        <RolesSection />
      </UseCasesProvider>,
    );
    expect(
      screen.queryByRole('table', { name: 'roles' }),
    ).not.toBeInTheDocument();
  });
});
