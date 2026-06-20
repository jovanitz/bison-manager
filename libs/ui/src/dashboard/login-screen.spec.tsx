import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import type { AccessClientUseCases } from '@acme/application';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  mockAccessUseCases,
  mockItems,
  testAuthSession,
} from '../access/testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { DashboardLoginScreen } from './login-screen';

const renderScreen = (access: AccessClientUseCases) =>
  render(
    <UseCasesProvider useCases={{ items: mockItems, access }}>
      <DashboardLoginScreen />
    </UseCasesProvider>,
  );

describe('DashboardLoginScreen', () => {
  it('is sign-in only when an owner already exists (no bootstrap offered)', async () => {
    renderScreen(mockAccessUseCases({ needsBootstrap: async () => ok(false) }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Sign in' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: 'Create the first owner' }),
    ).not.toBeInTheDocument();
  });

  it('offers a one-time owner sign-up on a fresh instance, dispatching signUp', async () => {
    const signUp = vi.fn(async () => ok(testAuthSession));
    renderScreen(
      mockAccessUseCases({ needsBootstrap: async () => ok(true), signUp }),
    );

    const createButton = await screen.findByRole('button', {
      name: 'Create the first owner',
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@local.dev' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(createButton);

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: 'owner@local.dev',
        password: 'Password123!',
      }),
    );
  });
});
