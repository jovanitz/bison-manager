import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ok } from '@acme/shared';
import type { AppUseCases } from '../di/use-cases-context';
import { UseCasesProvider } from '../di/use-cases-context';
import { ItemScreen } from './item-screen';

/**
 * Component test: render the real feature with *mock* use cases.
 *
 * No infrastructure, no network, no DOM persistence — just the contract the UI
 * depends on (the use-case bundle), faked. This proves the UI works against the
 * injected ports.
 */
const makeMockUseCases = (): AppUseCases => {
  const store: { id: string; name: string; status: 'active' | 'archived' }[] = [];
  let n = 0;
  return {
    items: {
      list: async () => store.filter((i) => i.status === 'active') as never,
      create: async ({ name }: { name: string }) => {
        const dto = {
          id: `item-${++n}`,
          name,
          status: 'active' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        };
        store.push(dto);
        return ok(dto);
      },
      archive: async ({ id }: { id: string }) => {
        const found = store.find((i) => i.id === id)!;
        found.status = 'archived';
        return ok({ ...found, status: 'archived' as const });
      },
      rename: async () => ok(store[0] as never),
      restore: async () => ok(store[0] as never),
      get: async () => ok(store[0] as never),
    },
  };
};

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UseCasesProvider useCases={makeMockUseCases()}>
        <ItemScreen />
      </UseCasesProvider>
    </QueryClientProvider>,
  );
};

describe('<ItemScreen />', () => {
  it('shows the empty state, then a created item', async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByText(/no items yet/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/item name/i), 'My Item');
    await user.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() =>
      expect(screen.getByText('My Item')).toBeInTheDocument(),
    );
  });

  it('validates required name', async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(/no items yet/i);
    await user.click(screen.getByRole('button', { name: /add/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/required/i);
  });
});
