import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { mockAccessUseCases, mockItems } from '../access/testing';
import { UseCasesProvider } from '../di/use-cases-context';
import { ClientHomeScreen } from './client-home-screen';
import { mockOrgs } from './testing';

const renderHome = (orgs = mockOrgs()) =>
  render(
    <UseCasesProvider
      useCases={{ items: mockItems, access: mockAccessUseCases({}), orgs }}
    >
      <ClientHomeScreen />
    </UseCasesProvider>,
  );

describe('ClientHomeScreen', () => {
  it('shows the current org, permissions and the org switcher', async () => {
    renderHome();
    await waitFor(() =>
      expect(screen.getByTestId('current-org')).toHaveTextContent('acct-1'),
    );
    const switcher = screen.getByRole('region', { name: 'my orgs' });
    expect(
      within(switcher).getByText(/Your organizations \(2\)/),
    ).toBeInTheDocument();
    // the current org is marked, the other offers Switch
    expect(within(switcher).getByText('— current')).toBeInTheDocument();
  });

  it('switches to another org', async () => {
    const switchAccount = vi.fn(async () => ok({ accountId: 'acct-2' }));
    renderHome(mockOrgs({ switchAccount }));
    await waitFor(() => screen.getByRole('button', { name: 'Switch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    await waitFor(() =>
      expect(switchAccount).toHaveBeenCalledWith('m-invited'),
    );
  });
});
