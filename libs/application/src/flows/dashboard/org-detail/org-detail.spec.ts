import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../../access/dto';
import type {
  OrgDetailGateway,
  OrgMemberDto,
  OrgSummaryDto,
} from '../../../access-client/ports';
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

describe('loadOrgDetail', () => {
  it('staff with members.read: full roster + derived owner, no impersonation', async () => {
    const result = await loadOrgDetail(
      {
        access: access([{ action: 'members.read', scope: 'any' }]),
        orgs: orgs(),
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
      },
      { accountId: 'org-11' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.tag).toBe('app/access-gateway-error');
  });
});
