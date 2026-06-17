import { type Result, type TaggedError, err, ok } from '@acme/shared';
import type { CurrentAccessDto } from '../../access/dto';
import type { StaffAccountSummary } from '../../access-directory/ports';
import type { CustomerAccountSummary } from '../../impersonation/ports';
import type { MemberSummaryDto } from '../../access-client/ports';
import type { AccessClientUseCases } from '../../access-client/use-cases';
import type { DirectoryUseCases } from '../../access-client/gateways/directory-use-cases';
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
  readonly canBlock: boolean;
};

export const loadDashboard = async (deps: {
  readonly access: AccessClientUseCases;
  readonly directory: DirectoryUseCases;
}): Promise<Result<DashboardViewModel, DashboardError>> => {
  const [staff, customers, snapshot] = await Promise.all([
    deps.directory.listStaff(),
    deps.directory.listCustomers(),
    deps.access.currentAccess(),
  ]);
  if (!staff.ok) return err(staff.error);
  if (!customers.ok) return err(customers.error);
  return ok({
    staff: staff.value,
    customers: customers.value,
    canBlock: snapshot.ok && holdsAction(snapshot.value, 'access.block'),
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
      readonly canEdit: boolean;
      readonly canBlock: boolean;
    };

export const loadStaffMembers = async (deps: {
  readonly access: AccessClientUseCases;
  readonly members: MembersUseCases;
}): Promise<Result<StaffMembersViewModel, DashboardError>> => {
  const snapshot = await deps.access.currentAccess();
  if (!snapshot.ok) return err(snapshot.error);
  const access = snapshot.value;
  if (!holdsAction(access, 'members.read')) return ok({ hidden: true });
  const listed = await deps.members.listMembers(access.accountId);
  if (!listed.ok) return err(listed.error);
  return ok({
    hidden: false,
    accountId: access.accountId,
    access,
    members: listed.value,
    canEdit: holdsAction(access, 'permissions.update'),
    canBlock: holdsAction(access, 'access.block'),
  });
};
