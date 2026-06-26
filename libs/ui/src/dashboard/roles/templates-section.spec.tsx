import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockAccessUseCases, mockItems } from '../../access/testing';
import { UseCasesProvider } from '../../di/use-cases-context';
import { TemplatesSection } from './templates-section';
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
      <TemplatesSection />
    </UseCasesProvider>,
  );

const readOnly = {
  ...adminAccess,
  permissions: [{ action: 'staff.read', scope: 'any' }],
};

describe('TemplatesSection', () => {
  it('lists the default templates with their scope', async () => {
    renderSection();
    expect(await screen.findByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Org Admin')).toBeInTheDocument();
    expect(screen.getByText('platform')).toBeInTheDocument();
    expect(screen.getByText('org')).toBeInTheDocument();
  });

  it('renames a template, preserving its permissions', async () => {
    const updateTemplate = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }));
    renderSection(mockRoles({ updateTemplate }));
    fireEvent.change(await screen.findByLabelText('template name support'), {
      target: { value: 'Support (tuned)' },
    });
    fireEvent.submit(
      screen.getByRole('form', { name: 'rename template support' }),
    );
    await waitFor(() =>
      expect(updateTemplate).toHaveBeenCalledWith({
        key: 'support',
        name: 'Support (tuned)',
        permissions: [{ action: 'staff.read', scope: 'any' }],
      }),
    );
  });

  it('resets a template to its code default', async () => {
    const resetTemplate = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }));
    renderSection(mockRoles({ resetTemplate }));
    expect(await screen.findByText('Support')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Reset' })[0]!);
    await waitFor(() => expect(resetTemplate).toHaveBeenCalledWith('support'));
  });

  it('applies a template to all instances, forks included', async () => {
    const applyTemplateToAll = vi.fn(async () => ({
      ok: true as const,
      value: { updated: 4 },
    }));
    renderSection(mockRoles({ applyTemplateToAll }));
    expect(await screen.findByText('Support')).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Apply to all' })[0]!,
    );
    await waitFor(() =>
      expect(applyTemplateToAll).toHaveBeenCalledWith('support'),
    );
  });

  it('hides management controls without permissions.update', async () => {
    renderSection(mockRoles(), readOnly);
    expect(await screen.findByText('Support')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset' }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when roles are not wired', () => {
    render(
      <UseCasesProvider useCases={{ items: mockItems }}>
        <TemplatesSection />
      </UseCasesProvider>,
    );
    expect(
      screen.queryByRole('table', { name: 'default templates' }),
    ).not.toBeInTheDocument();
  });
});
