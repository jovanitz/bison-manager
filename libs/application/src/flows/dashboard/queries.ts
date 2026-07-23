import { type Result, type TaggedError, err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type {
  OrphanIdentitySummary,
  StaffAccountSummary,
} from '../../access-directory/ports';
import type { CustomerAccountSummary } from '../../impersonation/ports';
import type { PendingInvitationSummary } from '../../access-invitations/ports';
import type { MemberSummaryDto } from '../../access-client/ports';
import type {
  AuditGateway,
  AuditRecordDto,
  SessionPoliciesDto,
  SettingsGateway,
} from '../../access-client/admin-ports';
import type {
  RolesGateway,
  RoleSummaryDto,
} from '../../access-client/roles-ports';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { DirectoryUseCases } from '../../access-client/gateways/directory-use-cases';
import type { InvitationsUseCases } from '../../access-client/gateways/invitations-use-cases';
import type { MembersUseCases } from '../../access-client/gateways/members-use-cases';
import { holdsAction, isPlatformAdmin } from '../capabilities';

export type DashboardError = TaggedError<
  'app/access-denied' | 'app/access-gateway-error'
>;

/** Admin route gate as a headless decision (mirrors RequireAdmin). */
export type AdminGateState =
  | 'anonymous'
  | 'forbidden'
  | 'blocked'
  | 'authorized';

export const resolveAdminGate = async (deps: {
  readonly access: AccessClientUseCases;
}): Promise<AdminGateState> => {
  const session = await deps.access.getSession();
  if (!session.ok) return 'anonymous';
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return 'anonymous';
  if (snapshot.value.blocked) return 'blocked';
  return isPlatformAdmin(snapshot.value) ? 'authorized' : 'forbidden';
};

/** Whether the actor may invite staff — gates the invite form's visibility. */
export const loadInviteCapability = async (deps: {
  readonly access: AccessClientUseCases;
}): Promise<Result<{ readonly canInvite: boolean }, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  return ok({ canInvite: holdsAction(snapshot.value, 'members.invite') });
};

/** The staff dashboard tables + whether the actor may soft-block. */
export type DashboardViewModel = {
  readonly staff: ReadonlyArray<StaffAccountSummary>;
  readonly customers: ReadonlyArray<CustomerAccountSummary>;
  readonly orphans: ReadonlyArray<OrphanIdentitySummary>;
  readonly pendingInvitations: ReadonlyArray<PendingInvitationSummary>;
  readonly canBlock: boolean;
  /** Owner-level account lifecycle (disable/enable/promote) — ADR-0010. */
  readonly canAdminAccounts: boolean;
};

export const loadDashboard = async (deps: {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
  readonly invitations: Pick<InvitationsUseCases, 'listPending'>;
}): Promise<Result<DashboardViewModel, DashboardError>> => {
  const [staff, customers, orphans, pending, snapshot] = await Promise.all([
    deps.directory.listStaff(),
    deps.directory.listCustomers(),
    deps.directory.listOrphans(),
    deps.invitations.listPending(),
    deps.access.currentAccess(),
  ]);
  if (!staff.ok) return err(staff.error);
  if (!customers.ok) return err(customers.error);
  if (!orphans.ok) return err(orphans.error);
  if (!pending.ok) return err(pending.error);
  return ok({
    staff: staff.value,
    customers: customers.value,
    orphans: orphans.value,
    pendingInvitations: pending.value,
    canBlock: snapshot.ok && holdsAction(snapshot.value, 'access.block'),
    canAdminAccounts:
      snapshot.ok && holdsAction(snapshot.value, 'account.disable'),
  });
};

/** The permissions editor's roster for the actor's own account. */
export type StaffMembersViewModel =
  | { readonly hidden: true }
  | {
      readonly hidden: false;
      readonly accountId: string;
      readonly access: CurrentAccessDto;
      readonly members: ReadonlyArray<MemberSummaryDto>;
      /** Roles assignable to these members (platform + the account's own). */
      readonly availableRoles: ReadonlyArray<RoleSummaryDto>;
      readonly canEdit: boolean;
      readonly canBlock: boolean;
      /** Whether the actor may view/revoke a member's sessions (sessions.read). */
      readonly canReadSessions: boolean;
    };

type RosterDeps = {
  readonly members: MembersUseCases;
  readonly roles: RolesGateway;
};

/** Build the roster for `accountId`: its members + the roles assignable to them,
 *  with the actor's edit/block/session gates. Shared by the two loaders below. */
const buildRoster = async (
  deps: RosterDeps,
  access: CurrentAccessDto,
  accountId: string,
): Promise<Result<StaffMembersViewModel, DashboardError>> => {
  const [listed, roles] = await Promise.all([
    deps.members.listMembers(accountId),
    deps.roles.listRoles(accountId),
  ]);
  if (!listed.ok) return err(listed.error);
  if (!roles.ok) return err(roles.error);
  return ok({
    hidden: false,
    accountId,
    access,
    members: listed.value,
    availableRoles: roles.value,
    canEdit: holdsAction(access, 'permissions.update'),
    canBlock: holdsAction(access, 'access.block'),
    canReadSessions: holdsAction(access, 'sessions.read'),
  });
};

export const loadStaffMembers = async (
  deps: { readonly access: AccessClientUseCases } & RosterDeps,
): Promise<Result<StaffMembersViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  if (!holdsAction(snapshot.value, 'members.read')) return ok({ hidden: true });
  return buildRoster(deps, snapshot.value, snapshot.value.accountId);
};

/** The roster for a SPECIFIC account — e.g. a Directory staff member's own
 *  account (the caller selects the row by identity). Gated the same way. */
export const loadAccountMembers = async (
  deps: { readonly access: AccessClientUseCases } & RosterDeps,
  accountId: string,
): Promise<Result<StaffMembersViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  if (!holdsAction(snapshot.value, 'members.read')) return ok({ hidden: true });
  return buildRoster(deps, snapshot.value, accountId);
};

/** The audit-trail view: recent security events (gated on `audit.read`). */
export type AuditViewModel =
  | { readonly hidden: true }
  | { readonly hidden: false; readonly entries: ReadonlyArray<AuditRecordDto> };

/** Load the most recent audit events for the platform-wide trail. */
export const loadAuditTrail = async (deps: {
  readonly access: AccessClientUseCases;
  readonly audit: AuditGateway;
}): Promise<Result<AuditViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  if (!holdsAction(snapshot.value, 'audit.read')) return ok({ hidden: true });
  const listed = await deps.audit.list({ limit: 50 });
  if (!listed.ok) return err(listed.error);
  return ok({ hidden: false, entries: listed.value });
};

/** The session-policy editor view (owner only): current policy + its version. */
export type SettingsViewModel =
  | { readonly hidden: true }
  | {
      readonly hidden: false;
      readonly policies: SessionPoliciesDto;
      readonly version: number;
    };

/** Load the runtime session policy for the editor (gated on settings.update). */
export const loadSessionPolicy = async (deps: {
  readonly access: AccessClientUseCases;
  readonly settings: SettingsGateway;
}): Promise<Result<SettingsViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  if (!holdsAction(snapshot.value, 'settings.update')) {
    return ok({ hidden: true });
  }
  const read = await deps.settings.read();
  if (!read.ok) return err(read.error);
  return ok({
    hidden: false,
    policies: read.value.policies,
    version: read.value.version,
  });
};
