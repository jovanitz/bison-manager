import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@acme/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  mockAccessUseCases,
  mockItems,
  testAuthSession,
} from '../access/testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { ClientLoginScreen } from './client-login-screen';

const fill = () => {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'me@acme.test' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'sup3r-secret' },
  });
};

describe('ClientLoginScreen', () => {
  it('signs in and signs up via the matching use cases', async () => {
    const signIn = vi.fn(async () => ok(testAuthSession));
    const signUp = vi.fn(async () => ok(testAuthSession));
    render(
      <UseCasesProvider
        useCases={{
          items: mockItems,
          access: mockAccessUseCases({ signIn, signUp }),
        }}
      >
        <ClientLoginScreen />
      </UseCasesProvider>,
    );
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
  });

  it('shows an auth error', async () => {
    render(
      <UseCasesProvider
        useCases={{
          items: mockItems,
          access: mockAccessUseCases({
            signIn: async () =>
              err({ tag: 'auth/provider-error', message: 'Invalid login' }),
          }),
        }}
      >
        <ClientLoginScreen />
      </UseCasesProvider>,
    );
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid login'),
    );
  });
});
