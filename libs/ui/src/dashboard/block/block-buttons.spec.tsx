import { describe, expect, it, vi } from 'vitest';
import { ok } from '@acme/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { mockItems } from '../../access/testing';
import { UseCasesProvider } from '../../di/use-cases-context';
import { BlockButtons } from './block-buttons';
import { mockBlock } from '../testing';

describe('BlockButtons', () => {
  it('blocks and unblocks an org', async () => {
    const blockOrg = vi.fn(async () => ok(undefined));
    const unblockOrg = vi.fn(async () => ok(undefined));
    render(
      <UseCasesProvider
        useCases={{ items: mockItems, block: mockBlock({ blockOrg, unblockOrg }) }}
      >
        <BlockButtons subject="org" id="acct-1" />
      </UseCasesProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() => expect(blockOrg).toHaveBeenCalledWith('acct-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(unblockOrg).toHaveBeenCalledWith('acct-1'));
  });

  it('blocks an identity', async () => {
    const blockIdentity = vi.fn(async () => ok(undefined));
    render(
      <UseCasesProvider
        useCases={{ items: mockItems, block: mockBlock({ blockIdentity }) }}
      >
        <BlockButtons subject="identity" id="user-1" />
      </UseCasesProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() => expect(blockIdentity).toHaveBeenCalledWith('user-1'));
  });

  it('renders nothing when block is not wired', () => {
    const { container } = render(
      <UseCasesProvider useCases={{ items: mockItems }}>
        <BlockButtons subject="org" id="acct-1" />
      </UseCasesProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
