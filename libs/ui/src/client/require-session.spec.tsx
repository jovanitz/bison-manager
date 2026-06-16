import { describe, expect, it } from 'vitest';
import { err, ok } from '@acme/shared';
import { render, screen, waitFor } from '@testing-library/react';
import {
  mockAccessUseCases,
  mockItems,
  testCurrentAccess,
} from '../access/testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { RequireSession } from './require-session';
import { mockOrgs } from './testing';
import type { AccessClientUseCases } from '@acme/application';

const renderGate = (access: AccessClientUseCases) =>
  render(
    <UseCasesProvider useCases={{ items: mockItems, access, orgs: mockOrgs() }}>
      <RequireSession>
        <p>client home</p>
      </RequireSession>
    </UseCasesProvider>,
  );

describe('RequireSession', () => {
  it('shows login when anonymous', async () => {
    renderGate(
      mockAccessUseCases({
        getSession: async () =>
          err({ tag: 'auth/provider-error', message: 'none' }),
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('form', { name: 'client login' }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('client home')).not.toBeInTheDocument();
  });

  it('renders children for any authenticated identity', async () => {
    renderGate(mockAccessUseCases({}));
    await waitFor(() =>
      expect(screen.getByText('client home')).toBeInTheDocument(),
    );
  });

  it('asks an org-less identity to create an organization', async () => {
    // valid Supabase session, but no actor (org-less) ⇒ currentAccess fails
    renderGate(
      mockAccessUseCases({
        currentAccess: async () =>
          err({ tag: 'app/access-denied', message: 'no actor' }),
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('form', { name: 'create organization' }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('client home')).not.toBeInTheDocument();
  });

  it('shows the blocked notice for a soft-blocked identity', async () => {
    renderGate(
      mockAccessUseCases({
        currentAccess: async () => ok({ ...testCurrentAccess, blocked: true }),
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/access is blocked/i),
    );
    expect(screen.queryByText('client home')).not.toBeInTheDocument();
  });
});
