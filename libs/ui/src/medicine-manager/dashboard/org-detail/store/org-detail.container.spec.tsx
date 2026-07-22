import { describe, expect, it } from 'vitest';
import { ok } from '@acme/shared';
import { render, screen, waitFor } from '@testing-library/react';
import {
  UseCasesProvider,
  type AppUseCases,
} from '../../../../di/use-cases-context';
import { OrgDetailSection } from '../org-detail.container';

const snapshot = {
  membershipId: 'mem',
  userId: 'me@acme.test',
  accountId: 'acc-self',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions: [
    { action: 'members.read', scope: 'any' },
    { action: 'members.block', scope: 'any' },
    { action: 'billing.read', scope: 'any' },
    { action: 'plans.manage', scope: 'any' },
  ],
  activeGrants: [],
};

/** Every bundle useOrgDetailStore requires must be present or it stays null. */
const useCases = {
  items: {},
  access: { currentAccess: async () => ok(snapshot) },
  orgDetail: {
    getSummary: async () =>
      ok({
        accountId: 'org-1',
        name: 'Clínica Norte',
        email: 'admin@norte.mx',
        status: 'active',
        createdAt: '2026-03-14T00:00:00Z',
      }),
    listMembers: async () =>
      ok([
        {
          membershipId: 'm-1',
          userId: 'u-1',
          displayName: 'Lucía Fuentes',
          email: 'lucia@norte.mx',
          roleNames: ['Owner'],
          isAccountOwner: true,
          isRoot: false,
          blocked: false,
        },
      ]),
  },
  billing: {
    getSummary: async () =>
      ok({
        accountId: 'org-1',
        planId: 'plan-pro',
        planKey: 'pro',
        planName: 'Pro',
        phase: 'active',
        trialEndsAt: null,
        paidThroughAt: '2026-12-31T00:00:00Z',
        seats: { used: 12, max: 25 },
        overLimit: false,
        price: { amountCents: 4900, currency: 'MXN', interval: 'month' },
        features: [],
        heldForPayment: false,
      }),
    listLedger: async () =>
      ok({
        currency: 'MXN',
        entries: [
          {
            id: 'chg-1',
            date: '2026-07-05T00:00:00Z',
            kind: 'charge',
            amountMinor: 5684,
            runningBalanceMinor: 5684,
            chargeStatus: 'paid',
            subtotalMinor: 4900,
            taxMinor: 784,
            period: {
              from: '2026-07-05T00:00:00Z',
              to: '2026-08-05T00:00:00Z',
            },
          },
        ],
      }),
  },
  members: { setMemberBlocked: async () => ok(undefined) },
} as unknown as AppUseCases;

describe('OrgDetailSection', () => {
  it('loads via the flow and renders the org, subscription and ledger', async () => {
    render(
      <UseCasesProvider useCases={useCases}>
        <OrgDetailSection accountId="org-1" onBack={() => undefined} />
      </UseCasesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText('Clínica Norte')).toBeInTheDocument(),
    );
    // subscription card + ledger row (mapped from the billing gateway)
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Jul 2026')).toBeInTheDocument();
  });
});
