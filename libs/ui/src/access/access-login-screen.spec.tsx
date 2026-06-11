import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { err } from '@acme/shared';
import { accessDenied } from '@acme/application';
import type { AccessClientUseCases } from '@acme/application';
import { mockAccessUseCases, mockItems } from './testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { AccessLoginScreen } from './access-login-screen';

const renderScreen = (access: AccessClientUseCases | undefined) =>
  render(
    <UseCasesProvider useCases={{ items: mockItems, access }}>
      <AccessLoginScreen />
    </UseCasesProvider>,
  );

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'a@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('AccessLoginScreen', () => {
  it('signs in and renders the gating snapshot (permissions)', async () => {
    renderScreen(mockAccessUseCases({}));
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByTestId('account-status')).toHaveTextContent(
        'acct-1 — active',
      ),
    );
    expect(screen.getByRole('list', { name: 'permissions' })).toHaveTextContent(
      'customer.read (own)',
    );
  });

  it('shows the auth error and stays signed out on bad credentials', async () => {
    renderScreen(
      mockAccessUseCases({
        signIn: async () =>
          err({ tag: 'auth/provider-error', message: 'Invalid login' }),
      }),
    );
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid login'),
    );
    expect(screen.getByRole('form', { name: 'login' })).toBeInTheDocument();
  });

  it('surfaces a denied access snapshot instead of pretending success', async () => {
    renderScreen(
      mockAccessUseCases({
        currentAccess: async () => err(accessDenied('Account is disabled.')),
      }),
    );
    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Account is disabled',
      ),
    );
  });

  it('signs out back to the form', async () => {
    renderScreen(mockAccessUseCases({}));
    fillAndSubmit();
    await waitFor(() => screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(screen.getByRole('form', { name: 'login' })).toBeInTheDocument(),
    );
  });

  it('says so when access use cases are not wired', () => {
    renderScreen(undefined);
    expect(screen.getByText(/not wired/i)).toBeInTheDocument();
  });
});
