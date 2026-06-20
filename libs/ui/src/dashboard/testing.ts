import { ok } from '@acme/shared';
import type {
  CurrentAccessDto,
  CustomerAccountSummary,
  DirectoryUseCases,
  BlockUseCases,
  InvitationsUseCases,
  MemberSummaryDto,
  MembersUseCases,
  OrphanIdentitySummary,
  PendingInvitationSummary,
  RolesGateway,
  RoleSummaryDto,
  StaffAccountSummary,
} from '@acme/application';

// `accountId` is a branded type minted in `domain`, which the UI layer may not
// import. For fixtures we mint values through the application type's own brand.
type AccountId = StaffAccountSummary['accountId'];
const id = (raw: string): AccountId => raw as AccountId;

/** Test doubles for the dashboard screens (spec-only by convention). */
export const testStaff: ReadonlyArray<StaffAccountSummary> = [
  {
    accountId: id('acct-owner'),
    email: 'owner@acme.test',
    displayName: 'Owner',
  },
  {
    accountId: id('acct-support'),
    email: 'support@acme.test',
    displayName: null,
  },
];

export const testCustomers: ReadonlyArray<CustomerAccountSummary> = [
  {
    accountId: id('acct-customer'),
    displayName: 'Casa Pampa',
    email: 'ops@casapampa.example',
  },
];

export const testOrphans: ReadonlyArray<OrphanIdentitySummary> = [
  {
    userId: 'user-zombie',
    email: 'zombie@acme.test',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const mockDirectory = (
  overrides: Partial<DirectoryUseCases> = {},
): DirectoryUseCases => ({
  listStaff: async () => ok(testStaff),
  listCustomers: async () => ok(testCustomers),
  listOrphans: async () => ok(testOrphans),
  ...overrides,
});

export const testPendingInvitations: ReadonlyArray<PendingInvitationSummary> = [
  {
    invitationId: 'inv-1' as PendingInvitationSummary['invitationId'],
    accountId: id('acct-owner'),
    email: 'invitee@acme.test',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-08T00:00:00.000Z',
  },
];

export const mockInvitations = (
  overrides: Partial<InvitationsUseCases> = {},
): InvitationsUseCases => ({
  invite: async () => ok({ invitationId: 'inv-1', token: 'tok-1' }),
  activate: async () => ok({ email: 'new@acme.test' }),
  listPending: async () => ok(testPendingInvitations),
  regenerate: async () => ok({ token: 'fresh-tok-1' }),
  ...overrides,
});

export const testMembers: ReadonlyArray<MemberSummaryDto> = [
  {
    membershipId: 'm-root',
    userId: 'owner@acme.test',
    permissions: [{ action: 'permissions.update', scope: 'any' }],
    roleIds: [],
    isRoot: true,
    blocked: false,
  },
  {
    membershipId: 'm-staff',
    userId: 'staff@acme.test',
    permissions: [{ action: 'staff.read', scope: 'any' }],
    roleIds: ['role-support'],
    isRoot: false,
    blocked: false,
  },
];

export const mockMembers = (
  overrides: Partial<MembersUseCases> = {},
): MembersUseCases => ({
  listMembers: async () => ok(testMembers),
  updatePermissions: async () => ok(undefined),
  removeMember: async () => ok(undefined),
  setMemberBlocked: async () => ok(undefined),
  ...overrides,
});

export const mockBlock = (
  overrides: Partial<BlockUseCases> = {},
): BlockUseCases => ({
  blockOrg: async () => ok(undefined),
  unblockOrg: async () => ok(undefined),
  blockIdentity: async () => ok(undefined),
  unblockIdentity: async () => ok(undefined),
  ...overrides,
});

export const testRoles: ReadonlyArray<RoleSummaryDto> = [
  {
    id: 'role-support',
    name: 'Support',
    accountId: null,
    permissions: [{ action: 'staff.read', scope: 'any' }],
  },
];

export const mockRoles = (
  overrides: Partial<RolesGateway> = {},
): RolesGateway => ({
  listRoles: async () => ok(testRoles),
  createRole: async () => ok({ roleId: 'role-new' }),
  deleteRole: async () => ok(undefined),
  assignRoles: async () => ok(undefined),
  ...overrides,
});

/** A full platform-admin snapshot — holds the management actions (any scope). */
export const adminAccess: CurrentAccessDto = {
  membershipId: 'membership-owner',
  userId: 'user-owner',
  accountId: 'acct-owner',
  accountStatus: 'active',
  blocked: false,
  session: {
    id: 'session-owner',
    status: 'active',
    expiresAt: '2026-12-31T00:00:00.000Z',
  },
  permissions: [
    { action: 'staff.read', scope: 'any' },
    { action: 'customer.search', scope: 'any' },
    { action: 'members.invite', scope: 'any' },
    { action: 'members.read', scope: 'any' },
    { action: 'permissions.update', scope: 'any' },
    { action: 'access.block', scope: 'any' },
  ],
  activeGrants: [],
};
