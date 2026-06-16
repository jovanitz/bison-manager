import { describe, expect, it } from 'vitest';
import { err } from '@acme/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { accessGatewayError } from '@acme/application';
import { mockAccessUseCases, mockItems } from '../../access/testing';
import { UseCasesProvider } from '../../di/use-cases-context';
import { InviteMemberForm } from './invite-member-form';
import { adminAccess, mockInvitations } from '../testing';

const renderForm = (
  invitations = mockInvitations(),
  access = adminAccess,
) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({
          currentAccess: async () => ({ ok: true, value: access }),
        }),
        invitations,
      }}
    >
      <InviteMemberForm />
    </UseCasesProvider>,
  );

const invite = async (email: string) => {
  fireEvent.change(await screen.findByLabelText(/email/i), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: /send invitation/i }));
};

describe('InviteMemberForm', () => {
  it('issues an invitation and shows the activation link with the token', async () => {
    renderForm(
      mockInvitations({
        invite: async () => ({
          ok: true,
          value: { invitationId: 'inv-9', token: 'secret-token' },
        }),
      }),
    );
    await invite('new@acme.test');
    await waitFor(() =>
      expect(screen.getByTestId('activation-link')).toHaveTextContent(
        '/activate#token=secret-token',
      ),
    );
  });

  it('surfaces an invite failure', async () => {
    renderForm(
      mockInvitations({
        invite: async () => err(accessGatewayError('nope')),
      }),
    );
    await invite('new@acme.test');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('nope'),
    );
  });

  it('renders nothing when invitations are not wired', () => {
    render(
      <UseCasesProvider useCases={{ items: mockItems }}>
        <InviteMemberForm />
      </UseCasesProvider>,
    );
    expect(
      screen.queryByRole('form', { name: 'invite' }),
    ).not.toBeInTheDocument();
  });

  it('hides the form for an actor without members.invite', async () => {
    renderForm(mockInvitations(), {
      ...adminAccess,
      permissions: [{ action: 'staff.read', scope: 'any' }],
    });
    // give the mount effect a tick; the form must never appear
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'invite' })).not.toBeInTheDocument(),
    );
  });
});
