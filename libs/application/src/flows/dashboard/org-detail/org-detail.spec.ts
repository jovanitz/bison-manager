import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../../access/dto';
import type {
  OrgDetailGateway,
  OrgMemberDto,
  OrgSummaryDto,
} from '../../../access-client/ports';
import type {
  BillingGateway,
  BillingSummaryDto,
} from '../../../access-client/billing-ports';
import type { AccessClientUseCases } from '../../../access-client/use-cases';
import { loadOrgDetail } from './org-detail';

const SUMMARY: OrgSummaryDto = {
  accountId: 'org-11',
  name: 'Clínica Norte',
  email: 'admin@norte.mx',
  status: 'active',
  createdAt: '2026-03-14',
};

const MEMBERS: ReadonlyArray<OrgMemberDto> = [
  {
    membershipId: 'm-1',
    userId: 'u-a',
    displayName: 'Lucía Fuentes',
    email: 'lucia@norte.mx',
    roleNames: ['Owner'],
    isAccountOwner: true,
    isRoot: false,
    blocked: false,
  },
  {
    membershipId: 'm-2',
    userId: 'u-b',
    displayName: 'Marco Peña',
    email: 'marco@norte.mx',
    roleNames: ['Admin'],
    isAccountOwner: false,
    isRoot: false,
    blocked: false,
  },
];

const snapshot = (
  permissions: CurrentAccessDto['permissions'],
): CurrentAccessDto => ({
  membershipId: 'mem',
  userId: 'staff@acme.test',
  accountId: 'acct-staff',
  accountStatus: 'active',
  blocked: false,
  session: { id: 's', status: 'active', expiresAt: '2099-01-01T00:00:00Z' },
  permissions,
  activeGrants: [],
});

const access = (perms: CurrentAccessDto['permissions']): AccessClientUseCases =>
  ({ currentAccess: async () => ok(snapshot(perms)) }) as AccessClientUseCases;

const orgs = (over: Partial<OrgDetailGateway> = {}): OrgDetailGateway => ({
  getSummary: async () => ok(SUMMARY),
  listMembers: async () => ok(MEMBERS),
  ...over,
});

const BILLING_SUMMARY: BillingSummaryDto = {
  accountId: 'org-11',
  planId: 'plan-basic',
  planKey: 'basico',
  planName: 'Básico',
  phase: 'active',
  trialEndsAt: '2026-04-14T00:00:00Z',
  paidThroughAt: '2026-08-01T00:00:00Z',
  seats: { used: 2, max: 10 },
  overLimit: false,
  price: { amountCents: 49900, currency: 'MXN', interval: 'month' },
  features: ['reports'],
  heldForPayment: false,
};

const billing = (
  over: Partial<Pick<BillingGateway, 'getSummary'>> = {},
): Pick<BillingGateway, 'getSummary'> => ({
  getSummary: async () => ok(BILLING_SUMMARY),
  ...over,
});

describe('loadOrgDetail', () => {
  it('staff with members.read: full roster + derived owner, no impersonation', async () => {
    const result = await loadOrgDetail(
      {
        access: access([{ action: 'members.read', scope: 'any' }]),
        orgs: orgs(),
        billing: billing(),
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canViewMembers).toBe(true);
    expect(result.value.canImpersonate).toBe(false);
    expect(result.value.members).toEqual(MEMBERS);
    expect(result.value.owner).toEqual({
      name: 'Lucía Fuentes',
      email: 'lucia@norte.mx',
    });
    expect(result.value.name).toBe('Clínica Norte');
  });

  it('support (impersonation.start, no members.read): summary only, roster gated, never fetched', async () => {
    const listMembers = vi.fn(async () => ok(MEMBERS));
    const result = await loadOrgDetail(
      {
        access: access([{ action: 'impersonation.start', scope: 'any' }]),
        orgs: orgs({ listMembers }),
        billing: billing(),
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canViewMembers).toBe(false);
    expect(result.value.canImpersonate).toBe(true);
    expect(result.value.members).toEqual([]);
    expect(result.value.owner).toBeNull();
    expect(listMembers).not.toHaveBeenCalled();
  });

  it('propagates a summary gateway error', async () => {
    const result = await loadOrgDetail(
      {
        access: access([{ action: 'members.read', scope: 'any' }]),
        orgs: orgs({
          getSummary: async () =>
            err({ tag: 'app/access-gateway-error', message: 'boom' }),
        }),
        billing: billing(),
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-gateway-error');
  });

  it('billing.read + plans.manage: subscription attached, levers enabled', async () => {
    const result = await loadOrgDetail(
      {
        access: access([
          { action: 'members.read', scope: 'any' },
          { action: 'billing.read', scope: 'any' },
          { action: 'plans.manage', scope: 'any' },
        ]),
        orgs: orgs(),
        billing: billing(),
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subscription).toEqual(BILLING_SUMMARY);
    expect(result.value.canManageBilling).toBe(true);
  });

  it('a billing summary failure never sinks the org-detail load', async () => {
    const result = await loadOrgDetail(
      {
        access: access([
          { action: 'members.read', scope: 'any' },
          { action: 'billing.read', scope: 'any' },
        ]),
        orgs: orgs(),
        billing: billing({
          getSummary: async () =>
            err({ tag: 'app/access-gateway-error', message: 'billing down' }),
        }),
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subscription).toBeUndefined();
    expect(result.value.name).toBe('Clínica Norte');
    expect(result.value.members).toEqual(MEMBERS);
    expect(result.value.canManageBilling).toBe(false);
  });

  it('without billing.read the summary is never fetched', async () => {
    const getSummary = vi.fn(async () => ok(BILLING_SUMMARY));
    const result = await loadOrgDetail(
      {
        access: access([{ action: 'members.read', scope: 'any' }]),
        orgs: orgs(),
        billing: billing({ getSummary }),
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subscription).toBeUndefined();
    expect(getSummary).not.toHaveBeenCalled();
  });
});
