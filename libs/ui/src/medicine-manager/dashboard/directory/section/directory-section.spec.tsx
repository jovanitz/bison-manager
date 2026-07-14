import { describe, expect, it } from 'vitest';
import { ok } from '@acme/shared';
import { render, screen, waitFor } from '@testing-library/react';
import {
  UseCasesProvider,
  type AppUseCases,
} from '../../../../di/use-cases-context';
import { DirectorySection } from './directory-section';

const snapshot = {
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [
    { action: 'access.block', scope: 'any' },
    { action: 'account.disable', scope: 'any' },
  ],
  activeGrants: [],
};

/** Every bundle useDirectoryStore requires must be present or it stays null. */
const useCases = {
  items: {},
  access: { currentAccess: async () => ok(snapshot) },
  directory: {
    listStaff: async () =>
      ok([{ accountId: 'acc-self', email: 'me@x.mx', displayName: 'Me' }]),
    listCustomers: async () =>
      ok([
        { accountId: 'org-1', displayName: 'Clínica Norte', email: 'c@x.mx' },
      ]),
    listOrphans: async () => ok([]),
  },
  invitations: {
    listPending: async () => ok([]),
    invite: async () => ok({ invitationId: 'i', token: 'tok' }),
    regenerate: async () => ok({ token: 'rot' }),
  },
  coverage: {
    coverageFor: async () => ({
      phase: 'suspended' as const,
      dormant: false,
      balanceMinor: 5684,
      currency: 'MXN',
      paidThroughAt: null,
    }),
  },
  block: {
    blockOrg: async () => ok(undefined),
    unblockOrg: async () => ok(undefined),
    blockIdentity: async () => ok(undefined),
    unblockIdentity: async () => ok(undefined),
  },
  accounts: {
    disable: async () => ok(undefined),
    enable: async () => ok(undefined),
    promote: async () => ok(undefined),
  },
} as unknown as AppUseCases;

describe('DirectorySection', () => {
  it('loads via the flow and renders the mapped customer rows', async () => {
    render(
      <UseCasesProvider useCases={useCases}>
        <DirectorySection
          onOpenOrg={() => undefined}
          onOpenStaff={() => undefined}
        />
      </UseCasesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText('Clínica Norte')).toBeInTheDocument(),
    );
  });
});
