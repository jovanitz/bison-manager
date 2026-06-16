import { afterEach, describe, expect, it } from 'vitest';
import { err } from '@acme/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockItems } from '../../access/testing';
import { UseCasesProvider } from '../../di/use-cases-context';
import { ActivateInvitationScreen } from './activate-invitation-screen';
import { mockInvitations } from '../testing';
import type { InvitationsUseCases } from '@acme/application';

const renderWithHash = (
  hash: string,
  invitations: InvitationsUseCases = mockInvitations(),
) => {
  window.location.hash = hash;
  return render(
    <UseCasesProvider useCases={{ items: mockItems, invitations }}>
      <ActivateInvitationScreen />
    </UseCasesProvider>,
  );
};

afterEach(() => {
  window.location.hash = '';
});

const setPasswordAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/new password/i), {
    target: { value: 'sup3r-secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
};

describe('ActivateInvitationScreen', () => {
  it('activates with the token from the URL fragment', async () => {
    renderWithHash('#token=abc123');
    setPasswordAndSubmit();
    await waitFor(() =>
      expect(screen.getByText(/account activated/i)).toBeInTheDocument(),
    );
  });

  it('refuses when the link has no token', () => {
    renderWithHash('#nope=1');
    expect(screen.getByRole('alert')).toHaveTextContent(/missing its token/i);
  });

  it('surfaces a server error (e.g. invalid/expired token)', async () => {
    renderWithHash(
      '#token=bad',
      mockInvitations({
        activate: async () =>
          err({
            tag: 'app/invitation-token-invalid',
            message: 'Invalid or expired invitation.',
          }),
      }),
    );
    setPasswordAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid or expired'),
    );
  });
});
