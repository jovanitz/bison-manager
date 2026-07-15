import type { DirectoryReadModel } from '@acme/application';
import type {
  CustomerRow,
  DirectoryVM,
  InvitationRow,
  OrphanRow,
  StaffRow,
} from '../directory/directory.columns';

/**
 * Maps the application `DirectoryReadModel` to the UI's `DirectoryVM` (ADR-0018
 * coverage → the Organizations health/payment fields). Pure — the store wraps
 * it. Fields with no backing yet (staff blocked/disabled/isRoot, customer
 * plan/memberCount) are simply omitted; the presentational layer treats them as
 * optional. Optional keys are spread conditionally for exactOptionalPropertyTypes.
 */
type StaffIn = DirectoryReadModel['staff'][number];
type CustomerIn = DirectoryReadModel['customers'][number];
type OrphanIn = DirectoryReadModel['orphans'][number];
type InviteIn = DirectoryReadModel['pendingInvitations'][number];

const ONE_DAY = 86_400_000;

/** Pending / expiring (≤2 days) / expired — derived from `expiresAt` vs `now`. */
const invitationStatus = (
  expiresAt: string,
  now: string,
): InvitationRow['status'] => {
  const left = Date.parse(expiresAt) - Date.parse(now);
  if (left <= 0) return 'expired';
  return left <= 2 * ONE_DAY ? 'expiring' : 'pending';
};

const toStaffRow = (s: StaffIn): StaffRow => ({
  accountId: s.accountId,
  userId: s.userId,
  isSelf: s.isSelf,
  blocked: s.blocked,
  disabled: s.disabled,
  isRoot: s.isRoot,
  ...(s.email ? { email: s.email } : {}),
  ...(s.displayName ? { displayName: s.displayName } : {}),
});

const toCustomerRow = (c: CustomerIn): CustomerRow => ({
  accountId: c.accountId,
  displayName: c.displayName,
  blocked: c.blocked,
  disabled: c.disabled,
  memberCount: c.memberCount,
  dormant: c.coverage?.dormant ?? false,
  // No per-charge count in coverage yet: any outstanding balance = "1 overdue".
  overduePayments: c.coverage && c.coverage.balanceMinor > 0 ? 1 : 0,
  ...(c.email ? { email: c.email } : {}),
  ...(c.coverage ? { phase: c.coverage.phase } : {}),
  ...(c.coverage?.plan ? { plan: c.coverage.plan } : {}),
});

const toInvitationRow = (i: InviteIn, now: string): InvitationRow => ({
  invitationId: i.invitationId,
  email: i.email,
  expiresAt: i.expiresAt,
  status: invitationStatus(i.expiresAt, now),
});

const toOrphanRow = (o: OrphanIn): OrphanRow => ({
  userId: o.userId,
  createdAt: o.createdAt,
  ...(o.email ? { email: o.email } : {}),
});

export const toDirectoryVM = (
  rm: DirectoryReadModel,
  now: string,
): DirectoryVM => ({
  staff: rm.staff.map(toStaffRow),
  customers: rm.customers.map(toCustomerRow),
  pendingInvitations: rm.pendingInvitations.map((i) => toInvitationRow(i, now)),
  orphans: rm.orphans.map(toOrphanRow),
  canBlock: rm.canBlock,
  canAdminAccounts: rm.canAdminAccounts,
  loading: false,
});
