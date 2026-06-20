import { describe, expect, it } from 'vitest';
import { err } from '@acme/shared';
import { accessGatewayError } from '@acme/application';
import { mockAccessUseCases, mockItems } from '../access/testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { DashboardScreen } from './dashboard-screen';
import { mockBlock, mockDirectory, mockInvitations } from './testing';
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from '@testing-library/react';

const renderScreen = (directory = mockDirectory()) =>
  render(
    <UseCasesProvider
      useCases={{
        items: mockItems,
        access: mockAccessUseCases({}),
        directory,
        block: mockBlock(),
        invitations: mockInvitations(),
      }}
    >
      <DashboardScreen />
    </UseCasesProvider>,
  );

describe('DashboardScreen', () => {
  it('renders the staff and customer tables from the directory', async () => {
    renderScreen();

    const staff = await screen.findByRole('table', { name: 'staff' });
    expect(within(staff).getByText('owner@acme.test')).toBeInTheDocument();
    expect(within(staff).getByText('support@acme.test')).toBeInTheDocument();

    const customers = screen.getByRole('table', { name: 'customers' });
    expect(within(customers).getByText('Casa Pampa')).toBeInTheDocument();
  });

  it('lists org-less "zombie" identities in their own section', async () => {
    renderScreen();
    const zombies = await screen.findByRole('table', { name: 'zombies' });
    expect(within(zombies).getByText('zombie@acme.test')).toBeInTheDocument();
  });

  it('lists pending invitations and reveals a fresh link on regenerate', async () => {
    renderScreen();
    const pending = await screen.findByRole('table', {
      name: 'pending invitations',
    });
    expect(within(pending).getByText('invitee@acme.test')).toBeInTheDocument();

    fireEvent.click(
      within(pending).getByRole('button', { name: 'Regenerate link' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('invite-link')).toHaveTextContent(
        'fresh-tok-1',
      ),
    );
  });

  it('surfaces a directory read error', async () => {
    renderScreen(
      mockDirectory({
        listStaff: async () => err(accessGatewayError('network down')),
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('network down'),
    );
  });
});
