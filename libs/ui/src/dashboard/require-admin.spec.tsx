import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import type { AccessClientUseCases } from '@acme/application';
import { mockAccessUseCases, mockItems } from '../access/testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { RequireAdmin } from './require-admin';
import { adminAccess } from './testing';
import { render, screen, waitFor } from '@testing-library/react';

const renderGate = (access: AccessClientUseCases) =>
  render(
    <UseCasesProvider useCases={{ items: mockItems, access }}>
      <RequireAdmin>
        <p>secret dashboard</p>
      </RequireAdmin>
    </UseCasesProvider>,
  );

describe('RequireAdmin', () => {
  it('shows the login form when there is no session', async () => {
    renderGate(
      mockAccessUseCases({
        getSession: async () =>
          err({ tag: 'auth/provider-error', message: 'No session' }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('form', { name: 'login' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });

  it('renders the protected children for a platform admin', async () => {
    renderGate(
      mockAccessUseCases({ currentAccess: async () => ok(adminAccess) }),
    );
    await waitFor(() =>
      expect(screen.getByText('secret dashboard')).toBeInTheDocument(),
    );
  });

  it('blocks a signed-in non-admin with a notice instead of the dashboard', async () => {
    // The default mock snapshot holds only `customer.read` (own scope).
    renderGate(mockAccessUseCases({}));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('no staff access'),
    );
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });

  it('shows the blocked notice for a soft-blocked admin (no dashboard)', async () => {
    renderGate(
      mockAccessUseCases({
        currentAccess: async () => ok({ ...adminAccess, blocked: true }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        /access is blocked/i,
      ),
    );
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument();
  });
});
