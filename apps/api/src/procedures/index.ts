import type {
  AccessAdminUseCases,
  AccessBlockUseCases,
  AccessDirectoryUseCases,
  AccessInvitationsUseCases,
  AccessMembersUseCases,
  AccessRolesUseCases,
  AccessSettingsUseCases,
  AccessUseCases,
  AuditTrailUseCases,
  ImpersonationUseCases,
} from '@acme/application';
import type { ApiProcedure } from '../rpc/procedure';
import { createAccessProcedures } from './access-procedures';
import { createAdminProcedures } from './admin-procedures';
import { createBlockProcedures } from './block-procedures';
import { createDirectoryProcedures } from './directory-procedures';
import { createImpersonationProcedures } from './impersonation-procedures';
import { createMembersProcedures } from './members/members-procedures';
import {
  createRolesProcedures,
  createTemplatesProcedures,
} from './roles-procedures';
import { createSettingsProcedures } from './settings-procedures';

export type ApiUseCases = {
  readonly access: AccessUseCases;
  readonly auditTrail: AuditTrailUseCases;
  readonly accessAdmin: AccessAdminUseCases;
  readonly accessDirectory: AccessDirectoryUseCases;
  readonly impersonation: ImpersonationUseCases;
  readonly accessSettings: AccessSettingsUseCases;
  readonly accessInvitations: AccessInvitationsUseCases;
  readonly accessMembers: AccessMembersUseCases;
  readonly accessBlock: AccessBlockUseCases;
  readonly accessRoles: AccessRolesUseCases;
};

/**
 * The declarative procedure registry — the API's entire surface in one list,
 * and the future MCP / AI-gateway tool registry. Every access use case is
 * declared here; nothing else is routable.
 */
export const createApiProcedures = (
  useCases: ApiUseCases,
): ReadonlyArray<ApiProcedure> => [
  ...createAccessProcedures(useCases),
  ...createAdminProcedures(useCases.accessAdmin),
  ...createBlockProcedures(useCases.accessBlock),
  ...createDirectoryProcedures(useCases.accessDirectory),
  ...createImpersonationProcedures(useCases.impersonation),
  ...createSettingsProcedures(useCases.accessSettings),
  ...createMembersProcedures(
    useCases.accessInvitations,
    useCases.accessMembers,
  ),
  ...createRolesProcedures(useCases.accessRoles),
  ...createTemplatesProcedures(useCases.accessRoles),
];
