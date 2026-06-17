import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BlockButtons } from './block-buttons';

/**
 * BlockButtons is now pure presentation: it calls `onBlock(blocked)` and shows
 * the notice the action returns. Which use case runs is decided in the
 * controller (covered by the flows specs).
 */
describe('BlockButtons', () => {
  it('dispatches block / unblock and shows the returned notice', async () => {
    const onBlock = vi.fn(async (blocked: boolean) =>
      blocked ? 'Blocked' : 'Unblocked',
    );
    render(<BlockButtons label="block org" onBlock={onBlock} />);

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() => expect(onBlock).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Blocked'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(onBlock).toHaveBeenCalledWith(false));
  });
});
