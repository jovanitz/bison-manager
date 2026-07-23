import type {
  AdminSessionDto,
  MemberSummaryDto,
  RoleSummaryDto,
} from '@acme/application';
import type {
  MemberRow,
  RoleOption,
  SessionRow,
} from '../../permissions/permissions.types';

/**
 * Pure mappers for the staff-detail (member) screen (ADR-0011). The member
 * summary carries no display name / email / block state (the Directory staff
 * tab owns those), so the honest label is the `userId`; permissions render as
 * "action:scope" chips; assigned `roleIds` drive the role toggles.
 */

const fmt = (p: { readonly action: string; readonly scope: string }): string =>
  `${p.action}:${p.scope}`;

export const toMemberRow = (dto: MemberSummaryDto): MemberRow => ({
  membershipId: dto.membershipId,
  userId: dto.userId,
  displayName: dto.userId,
  permissions: dto.permissions.map(fmt),
  roleIds: dto.roleIds,
  blocked: false,
});

export const toRoleOption = (dto: RoleSummaryDto): RoleOption => ({
  id: dto.id,
  name: dto.name,
});

export const toSessionRow = (dto: AdminSessionDto): SessionRow => ({
  id: dto.id,
  createdAt: dto.createdAt,
});
